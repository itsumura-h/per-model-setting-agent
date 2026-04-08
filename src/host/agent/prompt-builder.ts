import type { WorkspaceConversationMessage } from '../../core/index';
import type { ToolDefinition } from './tools/types';

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
		'When you need to use tools (file edits and/or file reads), return a single JSON object inside a fenced ```json block.',
		'The JSON must include assistantMessage (string). Include fileEdits and/or fileReads arrays only when those tools apply.',
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
