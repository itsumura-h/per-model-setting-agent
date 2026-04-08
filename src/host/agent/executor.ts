import { randomUUID } from 'node:crypto';

import { getWorkspaceExecutionContext } from '../../core/index';
import type { SettingsConfig, WorkspaceConversationMessage } from '../../core/index';
import { appendPermosaAgentDebugLog } from '../permosa-debug-log';
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
import type { AgentResult, AgentStreamObserver, AgentToolOutputs } from './types';

/** リトライ応答で空のツール出力は 1 回目の結果を引き継ぐ（listFiles のあと fileReads だけ返すケース向け） */
function mergeToolOutputsOnRetry(primary: AgentToolOutputs, retry: AgentToolOutputs): AgentToolOutputs {
	const merged: AgentToolOutputs = { ...primary };
	for (const [toolId, items] of Object.entries(retry)) {
		if (Array.isArray(items) && items.length > 0) {
			merged[toolId] = items;
		}
	}
	return merged;
}

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
		/** どのツールを有効にするか・ensureFileEdits の判定に使う。未指定時は `prompt`。ツールループの2ターン目以降は元のユーザー文を渡すこと。 */
		toolActivationPrompt?: string;
	},
) {
	const observer = options?.observer;
	const intentPrompt = (options?.toolActivationPrompt ?? prompt).trim();
	const { provider, model, configurationIssues, isReady } = getWorkspaceExecutionContext(settings);
	const debugMeta = {
		providerName: provider?.name,
		modelName: model?.name,
		modelId: model?.modelId,
	};
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
	const activeToolIds = getActiveToolIds(intentPrompt);
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
		const streamRaw = await requestAgentResponsesStream({
			client,
			modelId: model.modelId,
			prompt: conversationPrompt,
			systemPrompt,
			requestId,
			observer,
		});
		const primaryResult = ensureFileEdits(streamRaw, intentPrompt);
		await appendPermosaAgentDebugLog({
			phase: 'responses-api-stream',
			requestId,
			...debugMeta,
			systemPrompt,
			userPrompt: conversationPrompt,
			result: primaryResult,
		});

		const retryDirectives = collectRetryDirectivesForMissingOutputs(activeToolIds, primaryResult);
		if (retryDirectives.length > 0) {
			const retrySystemPrompt = buildSystemPrompt({
				contextPrompt,
				tools: agentTools,
				activeToolIds,
				extraInstructions: retryDirectives,
			});

			const retryRaw = await requestAgentCompletion({
				client,
				modelId: model.modelId,
				prompt: conversationPrompt,
				systemPrompt: retrySystemPrompt,
			});
			const retryResult = ensureFileEdits(retryRaw, intentPrompt);
			const mergedResult: AgentResult = {
				...retryResult,
				toolOutputs: mergeToolOutputsOnRetry(primaryResult.toolOutputs, retryResult.toolOutputs),
			};
			await appendPermosaAgentDebugLog({
				phase: 'chat-completions-retry',
				requestId,
				...debugMeta,
				systemPrompt: retrySystemPrompt,
				userPrompt: conversationPrompt,
				result: mergedResult,
			});

			return mergedResult;
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
			const fallbackRaw = await requestAgentChatCompletionStream({
				client,
				modelId: model.modelId,
				prompt: conversationPrompt,
				systemPrompt,
				requestId,
				observer,
			});
			const fallbackResult = ensureFileEdits(fallbackRaw, intentPrompt);
			await appendPermosaAgentDebugLog({
				phase: 'chat-completions-fallback',
				requestId,
				...debugMeta,
				systemPrompt,
				userPrompt: conversationPrompt,
				result: fallbackResult,
			});

			return fallbackResult;
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
