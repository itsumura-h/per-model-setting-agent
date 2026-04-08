import type { AgentShellExec } from '../types';
import type { ToolDefinition } from './types';

function normalizeAgentShellExec(value: unknown): AgentShellExec[] {
	if (!Array.isArray(value)) {
		return [];
	}

	return value
		.map((entry) => {
			if (!entry || typeof entry !== 'object' || Array.isArray(entry)) {
				return undefined;
			}

			const record = entry as Record<string, unknown>;
			const command = typeof record.command === 'string' ? record.command.trim() : '';
			const cwd = typeof record.cwd === 'string' ? record.cwd.trim() : undefined;

			if (!command) {
				return undefined;
			}

			return {
				command,
				...(cwd && cwd.length > 0 ? { cwd } : {}),
			};
		})
		.filter((entry): entry is AgentShellExec => Boolean(entry));
}

export const shellExecTool: ToolDefinition = {
	id: 'shell-exec',
	promptInstructions: [
		'When you need grep, find, build, test, git, or other shell commands, include a shellExec array in the JSON.',
		'shellExec must be an array of objects shaped like { "command": string, "cwd"?: string }.',
		'cwd is optional and is relative to the workspace root; omit it to run in the workspace root.',
		'If no shell command is needed, answer normally without listing shellExec.',
	],
	promptDirective: [
		'This request requires running a shell command in the workspace.',
		'Return JSON only in a fenced ```json block.',
		'Include shellExec with the command (and optional cwd).',
	],
	matchesRequest: (prompt: string) =>
		/(?:\bgrep\b|\bfind\s|(?:^|\s)(?:npm|pnpm|yarn|npx)\s|\bgit\s|\bcargo\s|\bmake\b|pytest|jest|eslint|tsc\b|vitest|ビルド|テスト実行|コマンド|run\s+tests|terminal|shell|シェル|実行して)/i.test(
			prompt,
		),
	safetyNotice: {
		title: 'シェル実行の注意',
		items: [
			'workspace root（またはその配下の cwd）でのみ実行される',
			'危険なコマンドは拒否される',
			'タイムアウトと出力サイズに上限がある',
		],
	},
	parseResponse: (parsed: Record<string, unknown>) => normalizeAgentShellExec(parsed.shellExec),
	retryDirective: [
		'Your previous response did not include shellExec.',
		'Respond again with JSON only and include shellExec with a command string.',
	],
};
