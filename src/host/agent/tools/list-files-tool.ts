import type { AgentListFiles } from '../types';
import type { ToolDefinition } from './types';

function normalizeAgentListFiles(value: unknown): AgentListFiles[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map((entry) => {
			if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
				return undefined;
			}

			const record = entry as Record<string, unknown>;
			const pattern = typeof record.pattern === 'string' ? record.pattern.trim() : undefined;
			const maxDepth =
				typeof record.maxDepth === 'number' && Number.isFinite(record.maxDepth) ? record.maxDepth : undefined;

			return {
				...(pattern && pattern.length > 0 ? { pattern } : {}),
				...(typeof maxDepth === 'number' ? { maxDepth } : {}),
			};
		})
		.filter((entry): entry is AgentListFiles => Boolean(entry));
}

export const listFilesTool: ToolDefinition = {
	id: 'list-files',
	promptInstructions: [
		'Before reading files whose paths are unknown, use listFiles to discover workspace paths.',
		'listFiles must be an array of objects shaped like { "pattern"?: string, "maxDepth"?: number }.',
		'pattern is a glob such as "**/*.ts" or "src/**". Omit pattern to list all files (up to limits).',
		'maxDepth limits directory depth from the workspace root (default 5).',
		'If no listing is needed, answer normally without listing listFiles.',
	],
	promptDirective: [
		'This request requires listing workspace files or directories.',
		'Return JSON only in a fenced ```json block.',
		'Include listFiles in the JSON.',
	],
	matchesRequest: (prompt: string) =>
		/(?:ファイル一覧|一覧を|list\s+files|file\s+list|directory\s+tree|プロジェクト\s*の構造|フォルダ構造|ツリー|tree\b|walk\s+the\s+workspace|glob\b|どんなファイル)/i.test(
			prompt,
		) || /(?:readme|README|リードミー)/i.test(prompt),
	safetyNotice: {
		title: 'ファイル一覧取得の注意',
		items: [
			'結果は workspace root 配下に限定される',
			'件数上限があり、省略される場合がある',
		],
	},
	parseResponse: (parsed: Record<string, unknown>) => normalizeAgentListFiles(parsed.listFiles),
	retryDirective: [
		'Your previous response did not include listFiles.',
		'Respond again with JSON only and include listFiles as an array (each item may include pattern and maxDepth).',
	],
};
