import OpenAI from 'openai';

import type { AgentResult, AgentToolOutputs } from './types';
import type { ToolDefinition } from './tools/types';

export function parseAgentResult(rawResponse: string, tools: readonly ToolDefinition[]): AgentResult {
	const trimmed = rawResponse.trim();
	const jsonCandidates = [
		...extractFencedCodeBlocks(trimmed, 'json'),
		...extractFencedCodeBlocks(trimmed, 'permosa-json'),
		...extractLooseJsonObjects(trimmed),
		trimmed,
	];

	const uniqueCandidates = [...new Set(jsonCandidates.filter((c) => c.trim().length > 0))];

	const parsedResults: Array<Omit<AgentResult, 'rawResponse'>> = [];
	for (const candidate of uniqueCandidates) {
		const parsed = tryParseAgentJson(candidate, tools, trimmed);
		if (parsed) {
			parsedResults.push(parsed);
		}
	}

	if (parsedResults.length === 0) {
		return {
			assistantMessage: trimmed,
			toolOutputs: {},
			rawResponse,
		};
	}

	if (parsedResults.length === 1) {
		return { ...parsedResults[0], rawResponse };
	}

	return { ...mergeMultipleParsedResults(parsedResults), rawResponse };
}

/**
 * モデルが複数のJSONブロックを返した場合、全ブロックの toolOutputs をマージする。
 * assistantMessage は最初の非空メッセージを採用する。
 */
function mergeMultipleParsedResults(
	results: Array<Omit<AgentResult, 'rawResponse'>>,
): Omit<AgentResult, 'rawResponse'> {
	const mergedToolOutputs: AgentToolOutputs = {};
	let assistantMessage = '';

	for (const result of results) {
		if (!assistantMessage && result.assistantMessage.trim().length > 0) {
			assistantMessage = result.assistantMessage;
		}

		for (const [toolId, items] of Object.entries(result.toolOutputs)) {
			if (!Array.isArray(items) || items.length === 0) {
				continue;
			}
			const existing = mergedToolOutputs[toolId];
			if (Array.isArray(existing)) {
				mergedToolOutputs[toolId] = [...existing, ...items];
			} else {
				mergedToolOutputs[toolId] = items;
			}
		}
	}

	return { assistantMessage, toolOutputs: mergedToolOutputs };
}

function tryParseAgentJson(
	candidate: string,
	tools: readonly ToolDefinition[],
	fallbackAssistantText: string,
): Omit<AgentResult, 'rawResponse'> | undefined {
	try {
		const parsed = parseJsonLenient(candidate) as unknown;
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

/** `JSON.parse` が失敗したとき、先頭のバランスの取れた `{...}` を抜き出して再試行する */
function parseJsonLenient(text: string): unknown {
	const trimmed = text.trim();
	try {
		return JSON.parse(trimmed);
	} catch {
		const extracted = extractFirstJsonObject(trimmed);
		if (!extracted) {
			throw new SyntaxError('No JSON object');
		}
		return JSON.parse(extracted);
	}
}

function extractFirstJsonObject(text: string): string | undefined {
	const start = text.indexOf('{');
	if (start === -1) {
		return undefined;
	}

	let depth = 0;
	let inString = false;
	let escape = false;

	for (let i = start; i < text.length; i++) {
		const c = text[i];

		if (inString) {
			if (escape) {
				escape = false;
				continue;
			}
			if (c === '\\') {
				escape = true;
				continue;
			}
			if (c === '"') {
				inString = false;
			}
			continue;
		}

		if (c === '"') {
			inString = true;
			continue;
		}
		if (c === '{') {
			depth++;
		}
		if (c === '}') {
			depth--;
			if (depth === 0) {
				return text.slice(start, i + 1);
			}
		}
	}

	return undefined;
}

/**
 * フェンス付きコードブロックを抽出する。
 * 閉じの ``` の直前に改行が無い（`}``` のように同一行で閉じる）ケースや、
 * `}``````json` のように壊れたフェンスが続くケースでも、先頭のブロックを取り切れるようにする。
 */
function extractFencedCodeBlocks(text: string, language: string) {
	const escapedLanguage = escapeRegExp(language);
	const pattern = new RegExp('(?:^|\\n)```' + escapedLanguage + '\\s*([\\s\\S]*?)\\s*```', 'gi');
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

/** テキスト内の `{` から始まる JSON 断片を候補として列挙（フェンス無し・重複モデル出力向け） */
function extractLooseJsonObjects(text: string): string[] {
	const candidates: string[] = [];
	let searchFrom = 0;

	while (searchFrom < text.length) {
		const start = text.indexOf('{', searchFrom);
		if (start === -1) {
			break;
		}

		const sliceFrom = text.slice(start);
		const extracted = extractFirstJsonObject(sliceFrom);
		if (extracted) {
			candidates.push(extracted);
			searchFrom = start + extracted.length;
			continue;
		}

		searchFrom = start + 1;
	}

	return candidates;
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
