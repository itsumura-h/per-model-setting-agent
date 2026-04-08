import OpenAI from 'openai';

import type { AgentResult, AgentToolOutputs } from './types';
import type { ToolDefinition } from './tools/types';

export function parseAgentResult(rawResponse: string, tools: readonly ToolDefinition[]): AgentResult {
	const trimmed = rawResponse.trim();
	const jsonCandidates = [
		...extractFencedCodeBlocks(trimmed, 'json'),
		...extractFencedCodeBlocks(trimmed, 'permosa-json'),
		trimmed,
	];

	for (const candidate of jsonCandidates) {
		const parsed = tryParseAgentJson(candidate, tools, trimmed);
		if (parsed) {
			return {
				...parsed,
				rawResponse,
			};
		}
	}

	return {
		assistantMessage: trimmed,
		toolOutputs: {},
		rawResponse,
	};
}

function tryParseAgentJson(
	candidate: string,
	tools: readonly ToolDefinition[],
	fallbackAssistantText: string,
): Omit<AgentResult, 'rawResponse'> | undefined {
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

		const toolOutputs: AgentToolOutputs = {};
		let hasToolPayload = false;

		for (const tool of tools) {
			const results = tool.parseResponse(record);
			if (results.length > 0) {
				toolOutputs[tool.id] = results;
				hasToolPayload = true;
			}
		}

		if (assistantMessage.trim().length === 0 && !hasToolPayload) {
			return undefined;
		}

		const resolvedAssistant =
			assistantMessage.trim().length > 0 ? assistantMessage.trim() : fallbackAssistantText;

		return {
			assistantMessage: resolvedAssistant,
			toolOutputs,
		};
	} catch {
		return undefined;
	}
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
