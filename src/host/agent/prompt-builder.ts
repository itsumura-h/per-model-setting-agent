import { createWorkspaceFileEditSafetyNotice } from '../../core/index';
import type { WorkspaceConversationMessage } from '../../core/index';

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

export function isFileEditRequest(prompt: string) {
	return /(?:ファイル|作成|編集|書き換え|update|edit|create|write|generate)/i.test(prompt);
}
