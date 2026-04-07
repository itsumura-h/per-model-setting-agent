import { useEffect } from 'preact/hooks';

import {
	createErrorWorkspaceExecutionState,
	createIdleWorkspaceExecutionState,
	createIdleWorkspaceFileEditState,
	updateWorkspaceExecutionStreamingText,
	type SettingsConfig,
	type WorkspaceExecutionState,
	type WorkspaceFileEditState,
} from '../../../core/index';
import type { AppState, ExtensionMessage, VsCodeApi } from '../types';

export type ExtensionMessagingDeps = {
	vscode?: VsCodeApi;
	settings: SettingsConfig;
	setBootstrapState: (value: AppState | ((current: AppState) => AppState)) => void;
	setSettings: (value: SettingsConfig) => void;
	setWorkspaceExecution: (value: WorkspaceExecutionState | ((current: WorkspaceExecutionState) => WorkspaceExecutionState)) => void;
	setWorkspaceFileEdit: (value: WorkspaceFileEditState) => void;
	setSaveStatus: (value: 'idle' | 'saving' | 'saved' | 'error') => void;
	setStatusMessage: (value: string) => void;
};

export function useExtensionMessaging({
	vscode,
	settings,
	setBootstrapState,
	setSettings,
	setWorkspaceExecution,
	setWorkspaceFileEdit,
	setSaveStatus,
	setStatusMessage,
}: ExtensionMessagingDeps) {
	useEffect(() => {
		const handler = (event: MessageEvent<ExtensionMessage>) => {
			const message = event.data;

			if (message.type === 'state-saved') {
				setBootstrapState(message.state);
				setSettings(message.state.settings);
				setWorkspaceExecution(message.state.workspaceExecution ?? createIdleWorkspaceExecutionState(message.state.settings));
				setWorkspaceFileEdit(message.state.workspaceFileEdit ?? createIdleWorkspaceFileEditState());
				setSaveStatus('saved');
				setStatusMessage(message.state.statusMessage);
				return;
			}

			if (message.type === 'state-error') {
				setSaveStatus('error');
				setStatusMessage(message.message);
				return;
			}

			if (message.type === 'workspace-execution-state') {
				setWorkspaceExecution(message.state);
				setBootstrapState((current) => ({
					...current,
					workspaceExecution: message.state,
					statusMessage:
						message.state.status === 'running'
							? 'Agent を実行しています。'
							: message.state.status === 'success'
								? 'Agent の応答を受信しました。'
								: message.state.status === 'error'
									? 'Agent の実行に失敗しました。'
									: current.statusMessage,
					errorMessage: message.state.status === 'error' ? message.state.errorMessage : undefined,
				}));
				return;
			}

			if (message.type === 'workspace-execution-stream-start') {
				setBootstrapState((current) => ({
					...current,
					statusMessage: 'Agent が応答の生成を始めました。',
					errorMessage: undefined,
				}));
				return;
			}

			if (message.type === 'workspace-execution-stream-delta') {
				setWorkspaceExecution((current) => {
					const nextExecution = updateWorkspaceExecutionStreamingText(current, message.event.accumulatedText);
					setBootstrapState((state) => ({
						...state,
						workspaceExecution: nextExecution,
						statusMessage: 'Agent が応答を生成しています。',
						errorMessage: undefined,
					}));
					return nextExecution;
				});
				return;
			}

			if (message.type === 'workspace-execution-stream-complete') {
				setWorkspaceExecution((current) => {
					const nextExecution = updateWorkspaceExecutionStreamingText(current, message.event.text, {
						assistantMessageStatus: 'complete',
					});
					setBootstrapState((state) => ({
						...state,
						workspaceExecution: nextExecution,
						statusMessage: 'Agent の応答を受信しました。',
						errorMessage: undefined,
					}));
					return nextExecution;
				});
				return;
			}

			if (message.type === 'workspace-execution-stream-error') {
				setWorkspaceExecution((current) => {
					const nextExecution = createErrorWorkspaceExecutionState(
						settings,
						current.prompt,
						message.event.errorMessage,
						current.response,
						current.messages,
					);
					setBootstrapState((state) => ({
						...state,
						workspaceExecution: nextExecution,
						statusMessage: 'Agent の実行に失敗しました。',
						errorMessage: message.event.errorMessage,
					}));
					return nextExecution;
				});
				return;
			}

			if (message.type === 'workspace-file-edit-state') {
				setWorkspaceFileEdit(message.state);
				setBootstrapState((current) => ({
					...current,
					workspaceFileEdit: message.state,
					statusMessage:
						message.state.status === 'saving'
							? 'ファイルを保存しています。'
							: message.state.status === 'success'
								? 'ファイルを保存しました。'
								: message.state.status === 'error'
									? 'ファイルの保存に失敗しました。'
									: current.statusMessage,
					errorMessage: message.state.status === 'error' ? message.state.errorMessage : undefined,
				}));
			}
		};

		window.addEventListener('message', handler);
		vscode?.postMessage({ type: 'request-state' });

		return () => window.removeEventListener('message', handler);
	}, [vscode, settings]);
}
