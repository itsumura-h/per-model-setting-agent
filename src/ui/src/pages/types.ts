import type { ModelConfig, ProviderConfig } from '../../../core/index';
import type { EditorState, ExtensionState, SettingsSection } from '../types';

export type GeneralSettingsPageProps = {
	bootstrapState: ExtensionState;
	selectedProvider?: ProviderConfig;
	selectedModel?: ModelConfig;
	syncStatus: 'idle' | 'saving' | 'saved' | 'error';
	syncMessage: string;
	onOpenSettings: (section: SettingsSection) => void;
};

export type ProviderSettingsPageProps = {
	editor: EditorState | null;
	setting: {
		selectedProviderId: string;
		providers: ProviderConfig[];
	};
	onOpenSettings: (section: SettingsSection) => void;
	onOpenProviderEditor: (provider?: ProviderConfig) => void;
	onCloseEditor: () => void;
	onSelectProvider: (providerId: string) => void;
	onDeleteProvider: (providerId: string) => void;
	onSaveProviderDraft: () => void;
	onSetProviderDraftPreset: (presetId: 'custom' | 'cometapi' | 'openrouter') => void;
	onUpdateProviderDraft: (patch: Partial<ProviderConfig>) => void;
	onUpdateProviderHeadersText: (value: string) => void;
	getProviderPreset: (provider: ProviderConfig) => { name: string } | undefined;
};

export type ModelSettingsPageProps = {
	editor: EditorState | null;
	setting: {
		selectedModelId: string;
		providers: ProviderConfig[];
	};
	selectedProvider?: ProviderConfig;
	providerModels: ModelConfig[];
	onOpenSettings: (section: SettingsSection) => void;
	onOpenModelEditor: (model?: ModelConfig) => void;
	onCloseEditor: () => void;
	onSelectModel: (modelId: string) => void;
	onDeleteModel: (modelId: string) => void;
	onSaveModelDraft: () => void;
	onSetModelProviderId: (providerId: string) => void;
	onUpdateModelDraft: (patch: Partial<ModelConfig>) => void;
};
