import { render } from 'preact';

import { SettingsView } from './components/settings-view';
import { WorkspaceView } from './components/workspace-view';
import { readBootstrapState, getVsCodeApi } from './lib/bootstrap';
import { useSettingApp } from './hooks/use-setting-app';
import './style.css';

const initialState = readBootstrapState();
const vscode = getVsCodeApi();

function App() {
	const app = useSettingApp({ initialState, vscode });

	return (
		<main class="grid w-full min-h-screen gap-4 overflow-x-hidden px-5 pt-4 pb-6 text-base-content">
			{app.surface === 'workspace' ? (
				<WorkspaceView
					bootstrapState={app.bootstrapState}
					setting={app.setting}
					providerModels={app.providerModels}
					runResult={app.runResult}
					settingSummary={app.settingSummary}
					configurationIssues={app.configurationIssues}
					prompt={app.prompt}
					syncStatus={app.syncStatus}
					syncMessage={app.syncMessage}
					onPromptInput={app.setPrompt}
					onSelectProvider={app.selectProvider}
					onSelectModel={app.selectModel}
					onRunPreview={app.runPreview}
					onOpenSettings={() => vscode?.postMessage({ type: 'open-settings-panel' })}
				/>
			) : (
				<SettingsView
					bootstrapState={app.bootstrapState}
					editor={app.editor}
					setting={app.setting}
					settingsNavigation={app.settingsNavigation}
					activeSettingsPanel={app.activeSettingsPanel}
					selectedProvider={app.selectedProvider}
					selectedModel={app.selectedModel}
					providerModels={app.providerModels}
					syncStatus={app.syncStatus}
					syncMessage={app.syncMessage}
					onReturnToWorkspace={app.returnToWorkspace}
					onOpenSettings={app.openSettings}
					onOpenProviderEditor={app.openProviderEditor}
					onOpenModelEditor={app.openModelEditor}
					onCloseEditor={app.closeEditor}
					onSelectProvider={app.selectProvider}
					onSelectModel={app.selectModel}
					onDeleteProvider={app.deleteProvider}
					onDeleteModel={app.deleteModel}
					onSaveProviderDraft={app.saveProviderDraft}
					onSaveModelDraft={app.saveModelDraft}
					onSetProviderDraftPreset={app.setProviderDraftPreset}
					onSetModelProviderId={app.setModelProviderId}
					onUpdateProviderDraft={app.updateProviderEditorDraft}
					onUpdateProviderHeadersText={app.updateProviderHeadersText}
					onUpdateModelDraft={app.updateModelEditorDraft}
					getProviderPreset={app.getProviderPreset}
				/>
			)}
		</main>
	);
}

render(<App />, document.getElementById('app') as HTMLElement);
