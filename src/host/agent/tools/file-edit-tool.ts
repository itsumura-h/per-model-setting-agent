import { createAgentToolFileEditSafetyNotice } from '../../../core/index';
import type { AgentFileEdit } from '../types';
import type { ToolDefinition } from './types';

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

export const fileEditTool: ToolDefinition = {
	id: 'file-edit',
	promptInstructions: [
		'If you need to edit files, only propose safe workspace-local edits and never touch paths outside the workspace root.',
		'If the user asks to create or edit files, do not ask for confirmation first.',
		'When editing files, include a fileEdits array in the JSON.',
		'fileEdits must be an array of objects shaped like { "relativePath": string, "content": string }.',
		'If no file edit is needed, answer normally without listing fileEdits.',
	],
	promptDirective: [
		'This request requires file creation or editing.',
		'Do not ask follow-up questions or confirmation questions.',
		'Return JSON only in a fenced ```json block.',
		'Include every file to create or update in fileEdits.',
	],
	matchesRequest: (prompt: string) =>
		/(?:ファイル|作成|編集|書き換え|update|edit|create|write|generate)/i.test(prompt),
	safetyNotice: createAgentToolFileEditSafetyNotice(),
	parseResponse: (parsed: Record<string, unknown>) => normalizeAgentFileEdits(parsed.fileEdits),
	retryDirective: [
		'Your previous response did not include fileEdits.',
		'Respond again with JSON only and include the required fileEdits.',
		'If the user asked to create a file without explicit content, use an empty string for content.',
	],
};
