import { createWorkspaceFileEditSafetyNotice } from './file-edit-state';
import {
	getConfigurationIssues,
	getSelectedModelStrict,
	getSelectedProvider,
	getWorkspaceExecutionContext,
} from './selectors';
import type {
	SettingsConfig,
	WorkspaceConversationMessage,
	WorkspaceExecutionState,
	WorkspaceExecutionStatus,
} from './types';

export function updateWorkspaceExecutionStreamingText(
	executionState: WorkspaceExecutionState,
	accumulatedText: string,
	options?: { assistantMessageStatus?: 'streaming' | 'complete' },
): WorkspaceExecutionState {
	const assistantMessageStatus = options?.assistantMessageStatus ?? 'streaming';
	const timestamp = new Date().toISOString();
	const messages = executionState.messages.map((message) => {
		const matchesById = Boolean(executionState.streamingMessageId && message.id === executionState.streamingMessageId);
		const matchesByRole =
			!executionState.streamingMessageId &&
			message.role === 'assistant' &&
			(assistantMessageStatus === 'complete' ? message.status !== 'error' : message.status === 'streaming');
		if (matchesById || matchesByRole) {
			return {
				...message,
				content: accumulatedText,
				status: assistantMessageStatus,
				timestamp,
			};
		}

		return message;
	});

	return {
		...executionState,
		response: accumulatedText,
		messages,
	};
}

export function remapWorkspaceExecutionForSetting(
	executionState: WorkspaceExecutionState,
	settings: SettingsConfig,
): WorkspaceExecutionState {
	const provider = getSelectedProvider(settings);
	const model = getSelectedModelStrict(settings);

	return {
		...executionState,
		providerName: provider?.name ?? '未選択',
		modelName: model?.name ?? '未選択',
		baseUrl: provider?.baseUrl ?? '未設定',
		configurationIssues: getConfigurationIssues(settings),
		fileEditSafetyNotice: createWorkspaceFileEditSafetyNotice(),
		timestamp: new Date().toISOString(),
	};
}

export function createWorkspaceExecutionState(input: {
	settings: SettingsConfig;
	prompt: string;
	status: WorkspaceExecutionStatus;
	title?: string;
	response?: string;
	messages?: WorkspaceConversationMessage[];
	streamingMessageId?: string;
	errorMessage?: string;
	canRetry?: boolean;
}): WorkspaceExecutionState {
	const { provider, model, configurationIssues } = getWorkspaceExecutionContext(input.settings);
	const prompt = input.prompt.trim();
	const status = input.status;
	const title =
		input.title ??
		(status === 'running' ? '実行中' : status === 'success' ? '実行完了' : status === 'error' ? '実行エラー' : '待機中');

	return {
		status,
		title,
		providerName: provider?.name ?? '未選択',
		modelName: model?.name ?? '未選択',
		baseUrl: provider?.baseUrl ?? '未設定',
		prompt: prompt.length > 0 ? prompt : '未入力',
		response:
			input.response ??
			(status === 'running'
				? '応答を待っています。'
				: status === 'success'
					? '応答を受信しました。'
					: status === 'error'
						? '実行に失敗しました。'
						: 'まだ実行していません。'),
		messages: input.messages ?? [],
		streamingMessageId: input.streamingMessageId,
		errorMessage: input.errorMessage,
		configurationIssues,
		fileEditSafetyNotice: createWorkspaceFileEditSafetyNotice(),
		timestamp: new Date().toISOString(),
		canRetry: input.canRetry ?? status !== 'idle',
	};
}

export function createIdleWorkspaceExecutionState(settings: SettingsConfig) {
	const hasConfigurationIssues = getConfigurationIssues(settings).length > 0;
	return createWorkspaceExecutionState({
		settings,
		prompt: '',
		status: 'idle',
		canRetry: false,
		response: hasConfigurationIssues ? '設定を確認してください。' : 'プロンプトを入力して送信してください。',
		messages: [],
	});
}

export function createRunningWorkspaceExecutionState(
	settings: SettingsConfig,
	prompt: string,
	messages: WorkspaceConversationMessage[] = [],
) {
	const now = new Date().toISOString();
	return createWorkspaceExecutionState({
		settings,
		prompt,
		status: 'running',
		canRetry: false,
		response: 'OpenAI 互換 Provider へ送信中です。',
		messages: [
			...messages,
			{
				id: `user-${now}`,
				role: 'user',
				title: 'あなた',
				content: prompt.trim().length > 0 ? prompt.trim() : '未入力',
				status: 'complete',
				timestamp: now,
				canRetry: false,
			},
			{
				id: `assistant-${now}`,
				role: 'assistant',
				title: '応答',
				content: '',
				status: 'streaming',
				timestamp: now,
				canRetry: false,
			},
		],
		streamingMessageId: `assistant-${now}`,
	});
}

export function createSuccessWorkspaceExecutionState(
	settings: SettingsConfig,
	prompt: string,
	response: string,
	messages: WorkspaceConversationMessage[] = [],
) {
	const now = new Date().toISOString();
	return createWorkspaceExecutionState({
		settings,
		prompt,
		status: 'success',
		canRetry: true,
		response,
		messages:
			messages.length > 0
				? messages.map((message) =>
						message.role === 'assistant' && message.status === 'streaming'
							? {
									...message,
									content: response,
									status: 'complete' as const,
									timestamp: now,
									canRetry: true,
							  }
							: message,
				  )
				: [
						{
							id: `assistant-${now}`,
							role: 'assistant',
							title: '応答',
							content: response,
							status: 'complete',
							timestamp: now,
							canRetry: true,
						},
				  ],
	});
}

export function createErrorWorkspaceExecutionState(
	settings: SettingsConfig,
	prompt: string,
	errorMessage: string,
	response = '実行に失敗しました。',
	messages: WorkspaceConversationMessage[] = [],
) {
	const now = new Date().toISOString();
	return createWorkspaceExecutionState({
		settings,
		prompt,
		status: 'error',
		canRetry: true,
		response,
		errorMessage,
		messages:
			messages.length > 0
				? messages.map((message) =>
						message.role === 'assistant' && message.status === 'streaming'
							? {
									...message,
									content: response,
									status: 'error' as const,
									timestamp: now,
									canRetry: true,
							  }
							: message,
				  )
				: [
						{
							id: `assistant-${now}`,
							role: 'error',
							title: 'エラー',
							content: errorMessage,
							status: 'error',
							timestamp: now,
							canRetry: true,
						},
				  ],
	});
}
