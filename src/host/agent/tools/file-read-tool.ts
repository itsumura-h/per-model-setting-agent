import type { AgentFileRead } from '../types';
import type { ToolDefinition } from './types';

function normalizeAgentFileReads(value: unknown): AgentFileRead[] {
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

			if (!relativePath) {
				return undefined;
			}

			return {
				relativePath,
			};
		})
		.filter((entry): entry is AgentFileRead => Boolean(entry));
}

export const fileReadTool: ToolDefinition = {
	id: 'file-read',
	name: 'File read',
	promptInstructions: [
		'When the user asks to read or show file contents, include a fileReads array in the JSON.',
		'fileReads must be an array of objects shaped like { "relativePath": string } listing workspace-relative paths.',
		'If no file read is needed, answer normally without listing fileReads.',
	],
	promptDirective: [
		'This request requires reading workspace files.',
		'Return JSON only in a fenced ```json block.',
		'Include every file path to read in fileReads.',
	],
	matchesRequest: (prompt: string) =>
		/(?:読む|読み取り|表示|内容|中身|read|open|show|cat|type)\b/i.test(prompt) ||
		/(?:ファイル|file).*(?:読|読み|表示|内容)/i.test(prompt),
	safetyNotice: {
		title: 'ファイル読み取り前の注意',
		items: [
			'workspace root 内の相対パスのみを指定する',
			'機密が含まれる可能性があるファイルは説明で明示する',
		],
	},
	parseResponse: (parsed: Record<string, unknown>) => normalizeAgentFileReads(parsed.fileReads),
	retryDirective: [
		'Your previous response did not include fileReads.',
		'Respond again with JSON only and include the required fileReads with relativePath fields.',
	],
};
