import {
	createErrorWorkspaceExecutionState,
	createIdleWorkspaceExecutionState,
	createRunningWorkspaceExecutionState,
	createSuccessWorkspaceExecutionState,
	getConfigurationIssues,
	normalizeSettingsConfig,
	type AppState,
	type ModelConfig,
	type ProviderConfig,
	type SettingsConfig,
	type WorkspaceExecutionState,
} from '../../../core/index';
import type { VsCodeApi } from '../types';

export type UseWorkspaceAgentParams = {
	vscode?: VsCodeApi;
	settings: SettingsConfig;
	setSettings: (value: SettingsConfig) => void;
	workspaceExecution: WorkspaceExecutionState;
	setWorkspaceExecution: (value: WorkspaceExecutionState | ((current: WorkspaceExecutionState) => WorkspaceExecutionState)) => void;
	setBootstrapState: (value: AppState | ((current: AppState) => AppState)) => void;
	prompt: string;
	setPrompt: (value: string) => void;
	selectedProvider: ProviderConfig | undefined;
	selectedModel: ModelConfig | undefined;
};

export function useWorkspaceAgent({
	vscode,
	settings,
	setSettings,
	workspaceExecution,
	setWorkspaceExecution,
	setBootstrapState,
	prompt,
	setPrompt,
	selectedProvider,
	selectedModel,
}: UseWorkspaceAgentParams) {
	function runAgent(nextPrompt?: string) {
		const sourcePrompt = nextPrompt ?? prompt;
		const trimmedPrompt = sourcePrompt.trim();
		if (trimmedPrompt.length === 0) {
			setWorkspaceExecution(createIdleWorkspaceExecutionState(settings));
			return;
		}

		const normalizedSettings = normalizeSettingsConfig(settings);
		const conversation = workspaceExecution.messages;
		const runningState = createRunningWorkspaceExecutionState(normalizedSettings, trimmedPrompt, workspaceExecution.messages);
		setWorkspaceExecution(runningState);
		setBootstrapState((current) => ({
			...current,
			settings: normalizedSettings,
			workspaceExecution: runningState,
			statusMessage: 'Agent を実行しています。',
			errorMessage: undefined,
		}));
		setPrompt('');

		if (vscode) {
			vscode.postMessage({
				type: 'run-workspace-agent',
				settings: normalizedSettings,
				prompt: trimmedPrompt,
				conversation,
			});
			return;
		}

		const configurationIssues = getConfigurationIssues(normalizedSettings);
		if (configurationIssues.length > 0) {
			const errorState = createErrorWorkspaceExecutionState(
				normalizedSettings,
				trimmedPrompt,
				configurationIssues.join('\n'),
				runningState.response,
				runningState.messages,
			);
			setWorkspaceExecution(errorState);
			setBootstrapState((current) => ({
				...current,
				workspaceExecution: errorState,
				statusMessage: '設定を確認してください。',
				errorMessage: errorState.errorMessage,
			}));
			return;
		}

		const previewResponse = `${selectedProvider?.name ?? 'Provider'} / ${selectedModel?.name ?? 'Model'} に "${trimmedPrompt}" を送信するローカルプレビューです。`;
		const successState = createSuccessWorkspaceExecutionState(
			normalizedSettings,
			trimmedPrompt,
			previewResponse,
			runningState.messages,
		);
		setWorkspaceExecution(successState);
		setBootstrapState((current) => ({
			...current,
			workspaceExecution: successState,
			statusMessage: 'ローカルプレビューで応答を表示しました。',
			errorMessage: undefined,
		}));
	}

	return { runAgent };
}
