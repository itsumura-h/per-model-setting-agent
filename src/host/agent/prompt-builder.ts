import type { WorkspaceConversationMessage } from '../../core/index';
import type { ToolDefinition } from './tools/types';

/** `buildToolFeedbackPrompt` 向け（オーケストレータの listFiles 実行ブロックと整合） */
export type ToolFeedbackListFilesBlock = {
	pattern: string;
	files: string[];
	truncated: boolean;
	totalCount: number;
	errorMessage?: string;
};

export type ToolFeedbackShellExecBlock = {
	command: string;
	cwd: string;
	stdout: string;
	stderr: string;
	exitCode: number | null;
	timedOut: boolean;
	truncated: boolean;
	errorMessage?: string;
};

/**
 * 中間ツール（listFiles / shellExec）実行後、次ターンのモデル入力に渡すプロンプト。
 */
export function buildToolFeedbackPrompt(
	originalPrompt: string,
	toolResults: { listFiles: ToolFeedbackListFilesBlock[]; shellExec: ToolFeedbackShellExecBlock[] },
): string {
	const parts: string[] = [];
	parts.push('Conversation history:');
	parts.push(`User: ${originalPrompt.trim()}`);

	for (const block of toolResults.listFiles) {
		if (block.errorMessage) {
			parts.push(['Assistant: listFiles の結果:', `pattern: ${block.pattern}`, block.errorMessage].join('\n'));
			continue;
		}
		const fileList =
			block.files.length > 0 ? block.files.map((f) => `- ${f}`).join('\n') : '（該当なし）';
		const truncatedNote = block.truncated ? '（件数上限により省略）' : '';
		parts.push(
			['Assistant: listFiles の結果:', `pattern: ${block.pattern}`, fileList, `件数: ${block.totalCount}`, truncatedNote]
				.filter(Boolean)
				.join('\n'),
		);
	}

	for (const block of toolResults.shellExec) {
		if (block.errorMessage) {
			parts.push(['Assistant: shellExec の結果:', `$ ${block.command}`, block.errorMessage].join('\n'));
			continue;
		}
		parts.push(
			[
				'Assistant: shellExec の結果:',
				`$ ${block.command}`,
				`(cwd: ${block.cwd})`,
				'stdout:',
				block.stdout,
				block.stderr ? `stderr:\n${block.stderr}` : '',
				`exitCode: ${block.exitCode === null ? 'null' : String(block.exitCode)}`,
				block.timedOut ? 'timedOut: true' : '',
				block.truncated ? 'truncated: true' : '',
			]
				.filter(Boolean)
				.join('\n\n'),
		);
	}

	parts.push('Current user request:');
	parts.push(
		`上記のツール結果を踏まえて、元のユーザーリクエスト「${originalPrompt.trim()}」を達成してください。必要なら追加のツール呼び出しを行ってください。`,
	);

	return parts.join('\n\n');
}

export function buildConversationPrompt({
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

	return ['Conversation history:', transcript, 'Current user request:', prompt.trim()].join('\n\n');
}

export function buildSystemPrompt({
	contextPrompt,
	tools,
	activeToolIds,
	extraInstructions,
}: {
	contextPrompt: string;
	tools: readonly ToolDefinition[];
	activeToolIds: string[];
	extraInstructions: string[];
}) {
	const baseInstructions = [
		'You are a VS Code workspace agent.',
		'Answer in Japanese unless the user asks for another language.',
		'Be concise, practical, and explicit about assumptions.',
		'When you need to use tools (list files, shell commands, file reads, and/or file edits), return a single JSON object inside a fenced ```json block.',
		'The JSON must include assistantMessage (string). Follow each enabled tool section below for keys such as listFiles, shellExec, fileReads, and fileEdits in the model output.',
	];

	const toolInstructions = tools.flatMap((tool) => {
		const lines = [...tool.promptInstructions];
		if (activeToolIds.includes(tool.id)) {
			lines.push(...tool.promptDirective);
		}
		lines.push(tool.safetyNotice.title);
		lines.push(...tool.safetyNotice.items.map((item) => `- ${item}`));
		return lines;
	});

	return [
		...baseInstructions,
		...toolInstructions,
		...extraInstructions,
		'Workspace context:',
		contextPrompt,
	].join('\n');
}
