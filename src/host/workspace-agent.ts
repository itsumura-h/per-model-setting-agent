import { randomUUID } from 'node:crypto';

import OpenAI, { APIError, type ChatCompletion } from 'openai';

import { createWorkspaceFileEditSafetyNotice, getWorkspaceExecutionContext } from '../core/index';
import type { ProviderConfig, SettingConfig, WorkspaceConversationMessage } from '../core/index';
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

export type WorkspaceAgentStreamEvent =
	| {
			type: 'start';
			requestId?: string;
			providerName: string;
			modelName: string;
			prompt: string;
			timestamp: string;
	  }
	| {
			type: 'delta';
			delta: string;
			accumulatedText: string;
			sequenceNumber?: number;
			timestamp: string;
	  }
	| {
			type: 'complete';
			text: string;
			fileEdits: WorkspaceAgentFileEdit[];
			rawResponse: string;
			requestId?: string;
			timestamp: string;
	  }
	| {
			type: 'error';
			errorMessage: string;
			requestId?: string;
			retryable: boolean;
			timestamp: string;
	  };

export type WorkspaceAgentStreamObserver = {
	onEvent?: (event: WorkspaceAgentStreamEvent) => void | Promise<void>;
	onStart?: (event: Extract<WorkspaceAgentStreamEvent, { type: 'start' }>) => void | Promise<void>;
	onDelta?: (event: Extract<WorkspaceAgentStreamEvent, { type: 'delta' }>) => void | Promise<void>;
	onComplete?: (event: Extract<WorkspaceAgentStreamEvent, { type: 'complete' }>) => void | Promise<void>;
	onError?: (event: Extract<WorkspaceAgentStreamEvent, { type: 'error' }>) => void | Promise<void>;
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
		agents.setOpenAIAPI?.('responses');
		return true;
	} catch {
		return false;
	}
}

export async function executeWorkspacePrompt(setting: SettingConfig, prompt: string) {
	return executeWorkspacePromptStream(setting, prompt);
}

export async function executeWorkspacePromptStream(
	setting: SettingConfig,
	prompt: string,
	options?: {
		conversation?: WorkspaceConversationMessage[];
		observer?: WorkspaceAgentStreamObserver;
	},
) {
	const observer = options?.observer;
	const { provider, model, configurationIssues, isReady } = getWorkspaceExecutionContext(setting);
	if (!isReady || !provider || !model) {
		throw new Error(configurationIssues.join('\n') || 'Provider / Model の設定が不足しています。');
	}

	await initializeOpenAIAgentsRuntime(provider);

	const client = createWorkspaceOpenAIClient(provider);
	const workspaceContext = collectWorkspaceContext();
	const contextPrompt = formatWorkspaceContextForPrompt(workspaceContext);
	const conversationPrompt = buildWorkspaceConversationPrompt({
		conversation: options?.conversation ?? [],
		prompt,
	});
	const fileEditSafetyNotice = createWorkspaceFileEditSafetyNotice();
	const fileEditDirective = isFileEditRequest(prompt)
		? [
				'This request requires file creation or editing.',
				'Do not ask follow-up questions or confirmation questions.',
				'Return JSON only in a fenced ```json block.',
				'Include every file to create or update in fileEdits.',
		  ]
		: [];
	const systemPrompt = buildWorkspaceAgentSystemPrompt({
		contextPrompt,
		fileEditSafetyNotice,
		fileEditDirective,
		extraInstructions: [],
	});
	const requestId = randomUUID();
	const trimmedPrompt = prompt.trim();

	await emitWorkspaceAgentStreamEvent(observer, {
		type: 'start',
		requestId,
		providerName: provider.name,
		modelName: model.name,
		prompt: trimmedPrompt,
		timestamp: new Date().toISOString(),
	});

	try {
		const primaryResult = ensureWorkspaceAgentFileEdits(
			await requestWorkspaceAgentResponsesStream({
			client,
			modelId: model.modelId,
			prompt: conversationPrompt,
			systemPrompt,
			requestId,
			observer,
			}),
			prompt,
		);

		if (fileEditDirective.length > 0 && primaryResult.fileEdits.length === 0) {
			const retrySystemPrompt = buildWorkspaceAgentSystemPrompt({
				contextPrompt,
				fileEditSafetyNotice,
				fileEditDirective: [
					...fileEditDirective,
					'Your previous response did not include fileEdits.',
					'Respond again with JSON only and include the required fileEdits.',
					'If the user asked to create a file without explicit content, use an empty string for content.',
				],
				extraInstructions: [],
			});

			return ensureWorkspaceAgentFileEdits(
				await requestWorkspaceAgentCompletion({
					client,
					modelId: model.modelId,
					prompt: conversationPrompt,
					systemPrompt: retrySystemPrompt,
				}),
				prompt,
			);
		}

		return primaryResult;
	} catch (error) {
		if (!shouldFallbackToChatCompletions(error)) {
			const normalizedError = formatWorkspaceAgentError(error);
			await emitWorkspaceAgentStreamEvent(observer, {
				type: 'error',
				errorMessage: normalizedError,
				requestId,
				retryable: false,
				timestamp: new Date().toISOString(),
			});
			throw error;
		}

		try {
			return ensureWorkspaceAgentFileEdits(
				await requestWorkspaceAgentChatCompletionStream({
					client,
					modelId: model.modelId,
					prompt: conversationPrompt,
					systemPrompt,
					requestId,
					observer,
				}),
				prompt,
			);
		} catch (chatError) {
			await emitWorkspaceAgentStreamEvent(observer, {
				type: 'error',
				errorMessage: formatWorkspaceAgentError(chatError),
				requestId,
				retryable: false,
				timestamp: new Date().toISOString(),
			});
			throw chatError;
		}
	}
}

function buildWorkspaceConversationPrompt({
	conversation,
	prompt,
}: {
	conversation: WorkspaceConversationMessage[];
	prompt: string;
}) {
	const transcript = conversation
		.filter((message) => message.status !== 'streaming')
		.map((message) => {
			const roleLabel =
				message.role === 'user'
					? 'User'
					: message.role === 'assistant'
						? 'Assistant'
						: message.role === 'error'
							? 'Error'
							: 'System';
			const content = message.content.trim();

			return content.length > 0 ? `${roleLabel}: ${content}` : undefined;
		})
		.filter((entry): entry is string => Boolean(entry))
		.join('\n');

	if (transcript.length === 0) {
		return prompt.trim();
	}

	return [
		'Conversation history:',
		transcript,
		'Current user request:',
		prompt.trim(),
	].join('\n\n');
}

function buildWorkspaceAgentSystemPrompt({
	contextPrompt,
	fileEditSafetyNotice,
	fileEditDirective,
	extraInstructions,
}: {
	contextPrompt: string;
	fileEditSafetyNotice: ReturnType<typeof createWorkspaceFileEditSafetyNotice>;
	fileEditDirective: string[];
	extraInstructions: string[];
}) {
	return [
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
	].join('\n');
}

async function emitWorkspaceAgentStreamEvent(
	observer: WorkspaceAgentStreamObserver | undefined,
	event: WorkspaceAgentStreamEvent,
) {
	await observer?.onEvent?.(event);

	if (event.type === 'start') {
		await observer?.onStart?.(event);
	}

	if (event.type === 'delta') {
		await observer?.onDelta?.(event);
	}

	if (event.type === 'complete') {
		await observer?.onComplete?.(event);
	}

	if (event.type === 'error') {
		await observer?.onError?.(event);
	}
}

function shouldFallbackToChatCompletions(error: unknown) {
	if (!(error instanceof APIError)) {
		return false;
	}

	return [400, 404, 405, 410, 415, 422, 501].includes(error.status ?? 0);
}

async function requestWorkspaceAgentResponsesStream({
	client,
	modelId,
	prompt,
	systemPrompt,
	requestId,
	observer,
}: {
	client: OpenAI;
	modelId: string;
	prompt: string;
	systemPrompt: string;
	requestId: string;
	observer?: WorkspaceAgentStreamObserver;
}): Promise<WorkspaceAgentResult> {
	const stream = await client.responses.create({
		model: modelId,
		instructions: systemPrompt,
		input: prompt,
		stream: true,
	});

	let accumulatedText = '';
	let sequenceNumber = 0;

	for await (const event of stream as AsyncIterable<Record<string, unknown>>) {
		if (event.type === 'response.output_text.delta') {
			const delta = typeof event.delta === 'string' ? event.delta : '';
			if (delta.length === 0) {
				continue;
			}

			accumulatedText += delta;
			sequenceNumber += 1;

			await emitWorkspaceAgentStreamEvent(observer, {
				type: 'delta',
				delta,
				accumulatedText,
				sequenceNumber,
				timestamp: new Date().toISOString(),
			});
			continue;
		}

		if (event.type === 'response.output_text.done') {
			const text = typeof event.text === 'string' ? event.text : '';
			if (text.length > accumulatedText.length) {
				accumulatedText = text;
			}
			continue;
		}

		if (event.type === 'response.completed') {
			return finalizeWorkspaceAgentStream({
				text: accumulatedText,
				requestId,
				observer,
			});
		}

		if (event.type === 'error') {
			const errorMessage =
				(typeof event.error === 'string' && event.error.trim().length > 0
					? event.error
					: typeof event.message === 'string' && event.message.trim().length > 0
						? event.message
						: 'Responses API stream error');
			throw new Error(errorMessage);
		}
	}

	return finalizeWorkspaceAgentStream({
		text: accumulatedText,
		requestId,
		observer,
	});
}

async function requestWorkspaceAgentChatCompletionStream({
	client,
	modelId,
	prompt,
	systemPrompt,
	requestId,
	observer,
}: {
	client: OpenAI;
	modelId: string;
	prompt: string;
	systemPrompt: string;
	requestId: string;
	observer?: WorkspaceAgentStreamObserver;
}): Promise<WorkspaceAgentResult> {
	const completion = await client.chat.completions.create({
		model: modelId,
		stream: true,
		messages: [
			{
				role: 'system',
				content: systemPrompt,
			},
			{ role: 'user', content: prompt },
		],
	});

	let accumulatedText = '';
	let sequenceNumber = 0;

	for await (const chunk of completion as AsyncIterable<Record<string, unknown>>) {
		const chunkRecord = chunk as { choices?: unknown };
		const choices = Array.isArray(chunkRecord.choices) ? chunkRecord.choices : [];
		const choice = choices[0] as { delta?: { content?: unknown } } | undefined;
		const delta = choice && typeof choice === 'object' ? (choice as { delta?: { content?: unknown } }).delta?.content : undefined;

		if (typeof delta === 'string' && delta.length > 0) {
			accumulatedText += delta;
			sequenceNumber += 1;

			await emitWorkspaceAgentStreamEvent(observer, {
				type: 'delta',
				delta,
				accumulatedText,
				sequenceNumber,
				timestamp: new Date().toISOString(),
			});
		}
	}

	return finalizeWorkspaceAgentStream({
		text: accumulatedText,
		requestId,
		observer,
	});
}

async function requestWorkspaceAgentCompletion({
	client,
	modelId,
	prompt,
	systemPrompt,
}: {
	client: OpenAI;
	modelId: string;
	prompt: string;
	systemPrompt: string;
}): Promise<WorkspaceAgentResult> {
	const completion = await client.chat.completions.create({
		model: modelId,
		messages: [
			{
				role: 'system',
				content: systemPrompt,
			},
			{ role: 'user', content: prompt },
		],
	});

	return parseWorkspaceAgentResult(extractChatCompletionText(completion));
}

function ensureWorkspaceAgentFileEdits(result: WorkspaceAgentResult, prompt: string): WorkspaceAgentResult {
	if (result.fileEdits.length > 0 || !isFileEditRequest(prompt)) {
		return result;
	}

	const inferredFileEdits = inferWorkspaceAgentFileEdits(prompt);
	if (inferredFileEdits.length === 0) {
		return result;
	}

	return {
		...result,
		fileEdits: inferredFileEdits,
	};
}

function inferWorkspaceAgentFileEdits(prompt: string): WorkspaceAgentFileEdit[] {
	const normalizedPrompt = prompt.trim();
	if (!normalizedPrompt) {
		return [];
	}

	const pathCandidates = [...normalizedPrompt.matchAll(/[A-Za-z0-9._/-]+\.[A-Za-z0-9._-]+/g)]
		.map((match) => match[0])
		.map((candidate) => candidate.replace(/^[/\\]+/, '').replace(/[.。．、,!?]+$/g, '').trim())
		.filter((candidate) => candidate.length > 0);

	const uniqueCandidates = [...new Set(pathCandidates)];
	if (uniqueCandidates.length === 0) {
		return [];
	}

	return uniqueCandidates.slice(0, 3).map((relativePath) => ({
		relativePath,
		content: '',
	}));
}

function extractChatCompletionText(completion: ChatCompletion) {
	return completion.choices
		.map((choice) => extractChatMessageContent(choice?.message?.content))
		.filter((content): content is string => content.trim().length > 0)
		.join('\n');
}

function extractChatMessageContent(content: unknown) {
	if (typeof content === 'string') {
		return content;
	}

	if (!Array.isArray(content)) {
		return '';
	}

	return content
		.map((part) => {
			if (typeof part === 'string') {
				return part;
			}

			if (!part || typeof part !== 'object') {
				return '';
			}

			const record = part as Record<string, unknown>;
			return typeof record.text === 'string' ? record.text : '';
		})
		.join('');
}

async function finalizeWorkspaceAgentStream({
	text,
	requestId,
	observer,
}: {
	text: string;
	requestId: string;
	observer?: WorkspaceAgentStreamObserver;
}): Promise<WorkspaceAgentResult> {
	const parsedResult = parseWorkspaceAgentResult(text);
	const completeEvent: Extract<WorkspaceAgentStreamEvent, { type: 'complete' }> = {
		type: 'complete',
		text: parsedResult.assistantMessage,
		fileEdits: parsedResult.fileEdits,
		rawResponse: parsedResult.rawResponse,
		requestId,
		timestamp: new Date().toISOString(),
	};

	await emitWorkspaceAgentStreamEvent(observer, completeEvent);
	return parsedResult;
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
		const assistantMessage =
			typeof record.assistantMessage === 'string'
				? record.assistantMessage
				: typeof record.message === 'string'
					? record.message
					: '';
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

			if (!relativePath) {
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
