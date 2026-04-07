import OpenAI, { APIError, type ChatCompletion } from 'openai';

import { createWorkspaceFileEditSafetyNotice, getWorkspaceExecutionContext } from '../core/index';
import type { ProviderConfig, SettingConfig } from '../core/index';
import { collectWorkspaceContext, formatWorkspaceContextForPrompt } from './workspace-context';

export type WorkspaceAgentFileEdit = {
	relativePath: string;
	content: string;
};

export type WorkspaceAgentResult = {
	assistantMessage: string;
	fileEdits: WorkspaceAgentFileEdit[];
	rawResponse: string;
};

function pickHeaders(headers: Record<string, string>) {
	return Object.fromEntries(
		Object.entries(headers).filter(([, value]) => typeof value === 'string' && value.trim().length > 0),
	);
}

export function createWorkspaceOpenAIClient(provider: ProviderConfig) {
	return new OpenAI({
		baseURL: provider.baseUrl,
		apiKey: provider.apiKey ?? '',
		defaultHeaders: pickHeaders(provider.headers),
	});
}

async function initializeOpenAIAgentsRuntime(provider: ProviderConfig) {
	const loader = new Function('return import("@openai/agents")') as () => Promise<
		Partial<{
			setDefaultOpenAIClient: (client: OpenAI) => void;
			setOpenAIAPI: (api: 'responses' | 'chat_completions') => void;
		}>
	>;

	try {
		const agents = await loader();
		agents.setDefaultOpenAIClient?.(createWorkspaceOpenAIClient(provider));
		agents.setOpenAIAPI?.('chat_completions');
		return true;
	} catch {
		return false;
	}
}

export async function executeWorkspacePrompt(setting: SettingConfig, prompt: string) {
	const { provider, model, configurationIssues, isReady } = getWorkspaceExecutionContext(setting);
	if (!isReady || !provider || !model) {
		throw new Error(configurationIssues.join('\n') || 'Provider / Model の設定が不足しています。');
	}

	await initializeOpenAIAgentsRuntime(provider);
	const client = createWorkspaceOpenAIClient(provider);
	const workspaceContext = collectWorkspaceContext();
	const contextPrompt = formatWorkspaceContextForPrompt(workspaceContext);
	const fileEditSafetyNotice = createWorkspaceFileEditSafetyNotice();
	const fileEditDirective = isFileEditRequest(prompt)
		? [
				'This request requires file creation or editing.',
				'Do not ask follow-up questions or confirmation questions.',
				'Return JSON only in a fenced ```json block.',
				'Include every file to create or update in fileEdits.',
		  ]
		: [];
	const initialResult = await requestWorkspaceAgentCompletion({
		client,
		modelId: model.modelId,
		contextPrompt,
		prompt: prompt.trim(),
		fileEditSafetyNotice,
		fileEditDirective,
		extraInstructions: [],
	});

	if (fileEditDirective.length > 0 && initialResult.fileEdits.length === 0) {
		return requestWorkspaceAgentCompletion({
			client,
			modelId: model.modelId,
			contextPrompt,
			prompt: prompt.trim(),
			fileEditSafetyNotice,
			fileEditDirective: [
				...fileEditDirective,
				'Your previous response did not include fileEdits.',
				'Respond again with JSON only and include the required fileEdits.',
			],
			extraInstructions: [],
		});
	}

	return initialResult;
}

export function formatWorkspaceAgentError(error: unknown) {
	if (error instanceof APIError) {
		const details = [
			`OpenAI API error (${error.status})`,
			error.name,
			error.message,
			error.request_id ? `request_id: ${error.request_id}` : '',
		].filter((value) => value.trim().length > 0);

		return details.join('\n');
	}

	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}

function extractChatCompletionText(completion: ChatCompletion) {
	const content = completion.choices[0]?.message?.content;
	if (typeof content === 'string') {
		return content;
	}

	if (Array.isArray(content)) {
		return content
			.map((part) => {
				if (typeof part === 'string') {
					return part;
				}

				if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
					return part.text;
				}

				return '';
			})
			.join('');
	}

	return '';
}

async function requestWorkspaceAgentCompletion({
	client,
	modelId,
	contextPrompt,
	prompt,
	fileEditSafetyNotice,
	fileEditDirective,
	extraInstructions,
}: {
	client: OpenAI;
	modelId: string;
	contextPrompt: string;
	prompt: string;
	fileEditSafetyNotice: ReturnType<typeof createWorkspaceFileEditSafetyNotice>;
	fileEditDirective: string[];
	extraInstructions: string[];
}) {
	const completion = await client.chat.completions.create({
		model: modelId,
		messages: [
			{
				role: 'system',
				content:
					[
						'You are a VS Code workspace agent.',
						'Answer in Japanese unless the user asks for another language.',
						'Be concise, practical, and explicit about assumptions.',
						'If you need to edit files, only propose safe workspace-local edits and never touch paths outside the workspace root.',
						'If the user asks to create or edit files, do not ask for confirmation first.',
						'Instead, return a single JSON object inside a fenced ```json block with keys assistantMessage and fileEdits.',
						'fileEdits must be an array of objects shaped like { "relativePath": string, "content": string }.',
						'If no file edit is needed, answer normally without a JSON block.',
						...fileEditDirective,
						...extraInstructions,
						fileEditSafetyNotice.title,
						...fileEditSafetyNotice.items.map((item) => `- ${item}`),
						'Workspace context:',
						contextPrompt,
					].join('\n'),
			},
			{ role: 'user', content: prompt },
		],
	});

	return parseWorkspaceAgentResult(extractChatCompletionText(completion));
}

function parseWorkspaceAgentResult(rawResponse: string): WorkspaceAgentResult {
	const trimmed = rawResponse.trim();
	const jsonCandidates = [
		...extractFencedCodeBlocks(trimmed, 'json'),
		...extractFencedCodeBlocks(trimmed, 'permosa-json'),
		trimmed,
	];

	for (const candidate of jsonCandidates) {
		const parsed = tryParseWorkspaceAgentJson(candidate);
		if (parsed) {
			return {
				assistantMessage: parsed.assistantMessage.trim().length > 0 ? parsed.assistantMessage.trim() : trimmed,
				fileEdits: parsed.fileEdits,
				rawResponse,
			};
		}
	}

	return {
		assistantMessage: trimmed,
		fileEdits: [],
		rawResponse,
	};
}

function tryParseWorkspaceAgentJson(candidate: string) {
	try {
		const parsed = JSON.parse(candidate) as unknown;
		if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
			return undefined;
		}

		const record = parsed as Record<string, unknown>;
		const assistantMessage = typeof record.assistantMessage === 'string' ? record.assistantMessage : typeof record.message === 'string' ? record.message : '';
		const fileEdits = normalizeWorkspaceAgentFileEdits(record.fileEdits);

		if (assistantMessage.trim().length === 0 && fileEdits.length === 0) {
			return undefined;
		}

		return {
			assistantMessage,
			fileEdits,
		};
	} catch {
		return undefined;
	}
}

function normalizeWorkspaceAgentFileEdits(value: unknown): WorkspaceAgentFileEdit[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map((entry) => {
			if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
				return undefined;
			}

			const record = entry as Record<string, unknown>;
			const relativePath = typeof record.relativePath === 'string' ? record.relativePath.trim() : '';
			const content = typeof record.content === 'string' ? record.content : '';

			if (!relativePath || !content.length) {
				return undefined;
			}

			return {
				relativePath,
				content,
			};
		})
		.filter((entry): entry is WorkspaceAgentFileEdit => Boolean(entry));
}

function extractFencedCodeBlocks(text: string, language: string) {
	const escapedLanguage = escapeRegExp(language);
	const pattern = new RegExp('(?:^|\\n)```' + escapedLanguage + '\\s*([\\s\\S]*?)\\n```', 'gi');
	const blocks: string[] = [];
	let match: RegExpExecArray | null;

	while ((match = pattern.exec(text)) !== null) {
		const block = match[1]?.trim();
		if (block) {
			blocks.push(block);
		}
	}

	return blocks;
}

function escapeRegExp(value: string) {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isFileEditRequest(prompt: string) {
	return /(?:ファイル|作成|編集|書き換え|update|edit|create|write|generate)/i.test(prompt);
}
