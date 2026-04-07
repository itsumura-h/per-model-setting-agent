import type {
	AppState,
	ExtensionMessage,
	ModelConfig,
	ProviderConfig,
	WorkspaceExecutionStreamEvent,
} from '../../core/index';

export type { ExtensionMessage, AppState, WorkspaceExecutionStreamEvent };

export type ProviderFormState = {
	kind: 'provider';
	mode: 'create' | 'edit';
	draft: ProviderConfig;
	headersText: string;
	errorMessage?: string;
};

export type ModelFormState = {
	kind: 'model';
	mode: 'create' | 'edit';
	draft: ModelConfig;
	errorMessage?: string;
};

export type FormEditorState = ProviderFormState | ModelFormState;

export type VsCodeApi = {
	postMessage(message: unknown): void;
	setState(state: unknown): void;
	getState<T>(): T | undefined;
};

export type SettingsSection = 'general' | 'provider' | 'model';

export type SettingsNavigationEntry = {
	key: SettingsSection;
	label: string;
	icon: string;
	panel: 'general' | 'provider' | 'model';
};
