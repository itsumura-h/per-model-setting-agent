import OpenAI from 'openai';

import type { AgentFileEdit, AgentResult } from './types';

export function parseAgentResult(rawResponse: string): AgentResult {
	const trimmed = rawResponse.trim();
	const jsonCandidates = [
		...extractFencedCodeBlocks(trimmed, 'json'),
		...extractFencedCodeBlocks(trimmed, 'permosa-json'),
		trimmed,
	];

	for (const candidate of jsonCandidates) {
		const parsed = tryParseAgentJson(candidate);
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

function tryParseAgentJson(candidate: string) {
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
		const fileEdits = normalizeAgentFileEdits(record.fileEdits);

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

function normalizeAgentFileEdits(value: unknown): AgentFileEdit[] {
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
		.filter((entry): entry is AgentFileEdit => Boolean(entry));
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

export function extractChatCompletionText(completion: OpenAI.Chat.Completions.ChatCompletion) {
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
