import { randomUUID } from 'node:crypto';

import { getWorkspaceExecutionContext } from '../../core/index';
import type { SettingsConfig, WorkspaceConversationMessage } from '../../core/index';
import { collectWorkspaceContext, formatWorkspaceContextForPrompt } from '../workspace-context';
import { createOpenAIClient, initializeOpenAIAgentsRuntime } from './client';
import { formatAgentError } from './error';
import { ensureFileEdits } from './file-edit-inference';
import { buildSystemPrompt, buildConversationPrompt } from './prompt-builder';
import {
	emitStreamEvent,
	requestAgentChatCompletionStream,
	requestAgentCompletion,
	requestAgentResponsesStream,
	shouldFallbackToChatCompletions,
} from './stream';
import { agentTools, getActiveToolIds } from './tools';
import type { AgentResult, AgentStreamObserver } from './types';

function collectRetryDirectivesForMissingOutputs(activeToolIds: string[], primaryResult: AgentResult): string[] {
	const directives: string[] = [];
	for (const id of activeToolIds) {
		const tool = agentTools.find((t) => t.id === id);
		if (!tool) {
			continue;
		}
		const outputs = primaryResult.toolOutputs[id];
		const len = Array.isArray(outputs) ? outputs.length : 0;
		if (len === 0) {
			directives.push(...tool.retryDirective);
		}
	}
	return directives;
}

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
	const activeToolIds = getActiveToolIds(prompt);
	const systemPrompt = buildSystemPrompt({
		contextPrompt,
		tools: agentTools,
		activeToolIds,
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

		const retryDirectives = collectRetryDirectivesForMissingOutputs(activeToolIds, primaryResult);
		if (retryDirectives.length > 0) {
			const retrySystemPrompt = buildSystemPrompt({
				contextPrompt,
				tools: agentTools,
				activeToolIds,
				extraInstructions: retryDirectives,
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
