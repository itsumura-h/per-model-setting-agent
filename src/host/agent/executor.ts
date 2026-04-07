import { randomUUID } from 'node:crypto';

import { createAgentToolFileEditSafetyNotice, getWorkspaceExecutionContext } from '../../core/index';
import type { SettingsConfig, WorkspaceConversationMessage } from '../../core/index';
import { collectWorkspaceContext, formatWorkspaceContextForPrompt } from '../workspace-context';
import { createOpenAIClient, initializeOpenAIAgentsRuntime } from './client';
import { formatAgentError } from './error';
import { ensureFileEdits } from './file-edit-inference';
import { buildSystemPrompt, buildConversationPrompt, isFileEditRequest } from './prompt-builder';
import {
	emitStreamEvent,
	requestAgentChatCompletionStream,
	requestAgentCompletion,
	requestAgentResponsesStream,
	shouldFallbackToChatCompletions,
} from './stream';
import type { AgentStreamObserver } from './types';

export async function executeWorkspacePrompt(settings: SettingsConfig, prompt: string) {
	return executeWorkspacePromptStream(settings, prompt);
}

export async function executeWorkspacePromptStream(
	settings: SettingsConfig,
	prompt: string,
	options?: {
		conversation?: WorkspaceConversationMessage[];
		observer?: AgentStreamObserver;
	},
) {
	const observer = options?.observer;
	const { provider, model, configurationIssues, isReady } = getWorkspaceExecutionContext(settings);
	if (!isReady || !provider || !model) {
		throw new Error(configurationIssues.join('\n') || 'Provider / Model の設定が不足しています。');
	}

	await initializeOpenAIAgentsRuntime(provider);

	const client = createOpenAIClient(provider);
	const workspaceContext = collectWorkspaceContext();
	const contextPrompt = formatWorkspaceContextForPrompt(workspaceContext);
	const conversationPrompt = buildConversationPrompt({
		conversation: options?.conversation ?? [],
		prompt,
	});
	const agentToolFileEditSafetyNotice = createAgentToolFileEditSafetyNotice();
	const fileEditDirective = isFileEditRequest(prompt)
		? [
				'This request requires file creation or editing.',
				'Do not ask follow-up questions or confirmation questions.',
				'Return JSON only in a fenced ```json block.',
				'Include every file to create or update in fileEdits.',
		  ]
		: [];
	const systemPrompt = buildSystemPrompt({
		contextPrompt,
		agentToolFileEditSafetyNotice,
		fileEditDirective,
		extraInstructions: [],
	});
	const requestId = randomUUID();
	const trimmedPrompt = prompt.trim();

	await emitStreamEvent(observer, {
		type: 'start',
		requestId,
		providerName: provider.name,
		modelName: model.name,
		prompt: trimmedPrompt,
		timestamp: new Date().toISOString(),
	});

	try {
		const primaryResult = ensureFileEdits(
			await requestAgentResponsesStream({
				client,
				modelId: model.modelId,
				prompt: conversationPrompt,
				systemPrompt,
				requestId,
				observer,
			}),
			prompt,
		);

		if (fileEditDirective.length > 0 && primaryResult.fileEdits.length === 0) {
			const retrySystemPrompt = buildSystemPrompt({
				contextPrompt,
				agentToolFileEditSafetyNotice,
				fileEditDirective: [
					...fileEditDirective,
					'Your previous response did not include fileEdits.',
					'Respond again with JSON only and include the required fileEdits.',
					'If the user asked to create a file without explicit content, use an empty string for content.',
				],
				extraInstructions: [],
			});

			return ensureFileEdits(
				await requestAgentCompletion({
					client,
					modelId: model.modelId,
					prompt: conversationPrompt,
					systemPrompt: retrySystemPrompt,
				}),
				prompt,
			);
		}

		return primaryResult;
	} catch (error) {
		if (!shouldFallbackToChatCompletions(error)) {
			const normalizedError = formatAgentError(error);
			await emitStreamEvent(observer, {
				type: 'error',
				errorMessage: normalizedError,
				requestId,
				retryable: false,
				timestamp: new Date().toISOString(),
			});
			throw error;
		}

		try {
			return ensureFileEdits(
				await requestAgentChatCompletionStream({
					client,
					modelId: model.modelId,
					prompt: conversationPrompt,
					systemPrompt,
					requestId,
					observer,
				}),
				prompt,
			);
		} catch (chatError) {
			await emitStreamEvent(observer, {
				type: 'error',
				errorMessage: formatAgentError(chatError),
				requestId,
				retryable: false,
				timestamp: new Date().toISOString(),
			});
			throw chatError;
		}
	}
}
