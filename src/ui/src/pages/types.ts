import type { ModelConfig, ProviderConfig } from '../../../core/index';
import type { AppState, FormEditorState, SettingsSection } from '../types';

export type GeneralSettingsPageProps = {
	bootstrapState: AppState;
};

export type ProviderSettingsPageProps = {
	editor: FormEditorState | null;
	settings: {
		selectedProviderId: string;
		providers: ProviderConfig[];
	};
	onOpenProviderEditor: (provider?: ProviderConfig) => void;
	onCloseEditor: () => void;
	onDeleteProvider: (providerId: string) => void;
	onSaveProviderDraft: () => void;
	onSetProviderDraftPreset: (presetId: 'custom' | 'cometapi' | 'openrouter') => void;
	onUpdateProviderDraft: (patch: Partial<ProviderConfig>) => void;
	onUpdateProviderHeadersText: (value: string) => void;
	getProviderPreset: (provider: ProviderConfig) => { name: string } | undefined;
};

export type ModelSettingsPageProps = {
	editor: FormEditorState | null;
	settings: {
		providers: ProviderConfig[];
		models: ModelConfig[];
	};
	onOpenModelEditor: (model?: ModelConfig) => void;
	onCloseEditor: () => void;
	onDeleteModel: (modelId: string) => void;
	onSaveModelDraft: () => void;
	onSetModelProviderId: (providerId: string) => void;
	onUpdateModelDraft: (patch: Partial<ModelConfig>) => void;
};
