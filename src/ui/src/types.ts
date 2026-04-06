import { createRunPreview, type ModelConfig, type ProviderConfig, type SettingConfig } from '../../core/index';

export type ExtensionState = {
	surface: 'workspace' | 'settings';
	setting: SettingConfig;
	filePath: string;
	loadMode: 'default' | 'loaded' | 'corrupt';
	message: string;
	errorMessage?: string;
	lastSavedAt?: string;
};

export type ProviderEditorState = {
	kind: 'provider';
	mode: 'create' | 'edit';
	draft: ProviderConfig;
	headersText: string;
	errorMessage?: string;
};

export type ModelEditorState = {
	kind: 'model';
	mode: 'create' | 'edit';
	draft: ModelConfig;
	errorMessage?: string;
};

export type EditorState = ProviderEditorState | ModelEditorState;

export type ExtensionMessage =
	| {
			type: 'state-saved';
			state: ExtensionState;
	  }
	| {
			type: 'state-error';
			message: string;
	  };

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

export type RunPreview = ReturnType<typeof createRunPreview>;
