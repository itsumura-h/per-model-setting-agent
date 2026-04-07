import type { ModelConfig, ProviderConfig } from '../../../core/index';
import { SettingsSidebar } from './settings-sidebar';
import { GeneralSettingsPage } from '../pages/general-settings-page';
import { ModelSettingsPage } from '../pages/model-settings-page';
import { ProviderSettingsPage } from '../pages/provider-settings-page';
import type { AppState, FormEditorState, SettingsNavigationEntry, SettingsSection } from '../types';

type SettingsViewProps = {
	bootstrapState: AppState;
	editor: FormEditorState | null;
	settings: {
		selectedProviderId: string;
		selectedModelId: string;
		providers: ProviderConfig[];
		models: ModelConfig[];
	};
	settingsNavigation: SettingsNavigationEntry[];
	activeSettingsPanel: SettingsSection;
	onOpenSettings: (section: SettingsSection) => void;
	onOpenProviderEditor: (provider?: ProviderConfig) => void;
	onOpenModelEditor: (model?: ModelConfig) => void;
	onCloseEditor: () => void;
	onDeleteProvider: (providerId: string) => void;
	onDeleteModel: (modelId: string) => void;
	onSaveProviderDraft: () => void;
	onSaveModelDraft: () => void;
	onSetProviderDraftPreset: (presetId: 'custom' | 'cometapi' | 'openrouter') => void;
	onSetModelProviderId: (providerId: string) => void;
	onUpdateProviderDraft: (patch: Partial<ProviderConfig>) => void;
	onUpdateProviderHeadersText: (value: string) => void;
	onUpdateModelDraft: (patch: Partial<ModelConfig>) => void;
	getProviderPreset: (provider: ProviderConfig) => { name: string } | undefined;
};

export function SettingsView({
	bootstrapState,
	editor,
	settings,
	settingsNavigation,
	activeSettingsPanel,
	onOpenSettings,
	onOpenProviderEditor,
	onOpenModelEditor,
	onCloseEditor,
	onDeleteProvider,
	onDeleteModel,
	onSaveProviderDraft,
	onSaveModelDraft,
	onSetProviderDraftPreset,
	onSetModelProviderId,
	onUpdateProviderDraft,
	onUpdateProviderHeadersText,
	onUpdateModelDraft,
	getProviderPreset,
}: SettingsViewProps) {
	return (
		<div class="flex w-full min-w-0 flex-col items-stretch overflow-hidden rounded-[20px] border border-[color:var(--vscode-panel-border)] md:flex-row">
			<div class="min-w-0 border-b border-[color:var(--vscode-panel-border)] md:basis-1/4 md:border-b-0 md:border-r">
				<SettingsSidebar settingsNavigation={settingsNavigation} activeSettingsPanel={activeSettingsPanel} onOpenSettings={onOpenSettings} />
			</div>

			<div class="min-w-0 md:basis-3/4">
				<div class="grid min-w-0 gap-4 px-5 pt-4 pb-6">
					{activeSettingsPanel === 'general' ? (
						<GeneralSettingsPage
							bootstrapState={bootstrapState}
						/>
					) : null}

					{activeSettingsPanel === 'provider' ? (
						<ProviderSettingsPage
							editor={editor}
							settings={settings}
							onOpenProviderEditor={onOpenProviderEditor}
							onCloseEditor={onCloseEditor}
							onDeleteProvider={onDeleteProvider}
							onSaveProviderDraft={onSaveProviderDraft}
							onSetProviderDraftPreset={onSetProviderDraftPreset}
							onUpdateProviderDraft={onUpdateProviderDraft}
							onUpdateProviderHeadersText={onUpdateProviderHeadersText}
							getProviderPreset={getProviderPreset}
						/>
					) : null}

					{activeSettingsPanel === 'model' ? (
						<ModelSettingsPage
							editor={editor}
							settings={settings}
							onOpenModelEditor={onOpenModelEditor}
							onCloseEditor={onCloseEditor}
							onDeleteModel={onDeleteModel}
							onSaveModelDraft={onSaveModelDraft}
							onSetModelProviderId={onSetModelProviderId}
							onUpdateModelDraft={onUpdateModelDraft}
						/>
					) : null}
				</div>
			</div>
		</div>
	);
}
