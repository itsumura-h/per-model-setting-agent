import type { AppState, SettingsConfig, WorkspaceExecutionState, WorkspaceFileEditState } from './types';

export type WorkspaceExecutionStreamEvent =
	| {
			type: 'start';
			requestId?: string;
			providerName: string;
			modelName: string;
			prompt: string;
			timestamp: string;
	  }
	| {
			type: 'delta';
			delta: string;
			accumulatedText: string;
			sequenceNumber?: number;
			timestamp: string;
	  }
	| {
			type: 'complete';
			text: string;
			fileEdits: { relativePath: string; content: string }[];
			rawResponse: string;
			requestId?: string;
			timestamp: string;
	  }
	| {
			type: 'error';
			errorMessage: string;
			requestId?: string;
			retryable: boolean;
			timestamp: string;
	  };

/** Webview → Extension Host */
export type WebviewMessage =
	| { type: 'request-state' }
	| { type: 'save-state'; settings: SettingsConfig }
	| {
			type: 'run-workspace-agent';
			settings: SettingsConfig;
			prompt: string;
			conversation: WorkspaceExecutionState['messages'];
	  }
	| { type: 'request-workspace-file-edit'; relativePath: string; content: string };

export type IncomingWebviewMessage = WebviewMessage | { type: 'open-settings-panel' } | { type: 'open-main-panel' };

/** Extension Host → Webview */
export type ExtensionMessage =
	| { type: 'state-saved'; state: AppState }
	| { type: 'state-error'; message: string }
	| { type: 'workspace-execution-state'; state: WorkspaceExecutionState }
	| {
			type: 'run-workspace-agent';
			settings: AppState['settings'];
			prompt: string;
			conversation: WorkspaceExecutionState['messages'];
	  }
	| { type: 'workspace-execution-stream-start'; event: Extract<WorkspaceExecutionStreamEvent, { type: 'start' }> }
	| { type: 'workspace-execution-stream-delta'; event: Extract<WorkspaceExecutionStreamEvent, { type: 'delta' }> }
	| { type: 'workspace-execution-stream-complete'; event: Extract<WorkspaceExecutionStreamEvent, { type: 'complete' }> }
	| { type: 'workspace-execution-stream-error'; event: Extract<WorkspaceExecutionStreamEvent, { type: 'error' }> }
	| { type: 'workspace-file-edit-state'; state: WorkspaceFileEditState };
