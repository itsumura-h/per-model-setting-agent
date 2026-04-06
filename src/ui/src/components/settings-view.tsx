import type { ModelConfig, ProviderConfig } from '../../../core/index';
import { GeneralSettingsPage } from '../pages/general-settings-page';
import { ModelSettingsPage } from '../pages/model-settings-page';
import { ProviderSettingsPage } from '../pages/provider-settings-page';
import type { EditorState, ExtensionState, SettingsNavigationEntry, SettingsSection } from '../types';

type SettingsViewProps = {
	bootstrapState: ExtensionState;
	editor: EditorState | null;
	setting: {
		selectedProviderId: string;
		selectedModelId: string;
		providers: ProviderConfig[];
		models: ModelConfig[];
	};
	settingsNavigation: SettingsNavigationEntry[];
	activeSettingsPanel: SettingsSection;
	selectedProvider?: ProviderConfig;
	selectedModel?: ModelConfig;
	providerModels: ModelConfig[];
	syncStatus: 'idle' | 'saving' | 'saved' | 'error';
	syncMessage: string;
	onReturnToWorkspace: () => void;
	onOpenSettings: (section: SettingsSection) => void;
	onOpenProviderEditor: (provider?: ProviderConfig) => void;
	onOpenModelEditor: (model?: ModelConfig) => void;
	onCloseEditor: () => void;
	onSelectProvider: (providerId: string) => void;
	onSelectModel: (modelId: string) => void;
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
	setting,
	settingsNavigation,
	activeSettingsPanel,
	selectedProvider,
	selectedModel,
	providerModels,
	syncStatus,
	syncMessage,
	onReturnToWorkspace,
	onOpenSettings,
	onOpenProviderEditor,
	onOpenModelEditor,
	onCloseEditor,
	onSelectProvider,
	onSelectModel,
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
		<div class="grid w-full min-w-0 items-stretch overflow-hidden rounded-[20px] border border-[color:var(--vscode-panel-border)] grid-cols-1 md:[grid-template-columns:minmax(15.5rem,17.5rem)_minmax(0,1fr)]">
			<div class="min-w-0 border-b border-[color:var(--vscode-panel-border)] md:border-b-0 md:border-r">
				<aside class="grid min-h-full content-start gap-2.5 px-3 py-3 md:sticky md:top-0" aria-label="設定カテゴリ">
					<div class="inline-flex h-4 w-4 items-center justify-center" aria-hidden="true">
						□
					</div>

					<ul class="m-0 grid list-none gap-1 p-0">
						{settingsNavigation.map((entry) => (
							<li key={entry.key}>
								<button
									class="flex w-full items-center justify-start gap-2.5 rounded-xl border-0 px-3 py-2 text-left transition-colors duration-150"
									type="button"
									onClick={() => onOpenSettings(entry.key)}
									aria-pressed={activeSettingsPanel === entry.key}
								>
									<span class="inline-flex h-5 w-5 shrink-0 items-center justify-center text-sm">{entry.icon}</span>
									<span class="min-w-0 text-sm font-medium leading-tight">{entry.label}</span>
								</button>
							</li>
						))}
					</ul>
				</aside>
			</div>

			<div class="min-w-0">
				<div class="grid min-w-0 gap-4 px-5 pt-4 pb-6">
					<div class="flex flex-wrap items-end justify-between gap-3">
						<div>
							<p class="m-0 mb-2 text-xs font-bold uppercase tracking-[0.16em]">Codex Settings</p>
						</div>
					</div>

					{activeSettingsPanel === 'general' ? (
						<GeneralSettingsPage
							bootstrapState={bootstrapState}
							selectedProvider={selectedProvider}
							selectedModel={selectedModel}
							syncStatus={syncStatus}
							syncMessage={syncMessage}
							onOpenSettings={onOpenSettings}
						/>
					) : null}

					{activeSettingsPanel === 'provider' ? (
						<ProviderSettingsPage
							editor={editor}
							setting={setting}
							onOpenSettings={onOpenSettings}
							onOpenProviderEditor={onOpenProviderEditor}
							onCloseEditor={onCloseEditor}
							onSelectProvider={onSelectProvider}
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
							setting={setting}
							selectedProvider={selectedProvider}
							providerModels={providerModels}
							onOpenSettings={onOpenSettings}
							onOpenModelEditor={onOpenModelEditor}
							onCloseEditor={onCloseEditor}
							onSelectModel={onSelectModel}
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
