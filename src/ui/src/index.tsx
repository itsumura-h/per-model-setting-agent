import { render } from 'preact';

import { SettingsView } from './components/settings-view';
import { WorkspaceView } from './components/workspace-view';
import { readBootstrapState, getVsCodeApi } from './lib/bootstrap';
import { useSettingsApp } from './hooks/use-settings-app';
import './style.css';

const initialState = readBootstrapState();
const vscode = getVsCodeApi();

function App() {
	const app = useSettingsApp({ initialState, vscode });

	return (
		<main class="grid w-full min-h-screen items-stretch gap-4 overflow-x-hidden px-5 pt-4 pb-6 text-base-content">
			{app.viewMode === 'workspace' ? (
					<WorkspaceView
						settings={app.settings}
						workspaceExecution={app.workspaceExecution}
						workspaceFileEdit={app.workspaceFileEdit}
						configurationIssues={app.configurationIssues}
						prompt={app.prompt}
						fileEditRelativePath={app.fileEditRelativePath}
						fileEditContent={app.fileEditContent}
						onPromptInput={app.setPrompt}
						onSelectModel={app.selectModel}
						onRunAgent={app.runAgent}
						onFileEditRelativePathInput={app.setFileEditRelativePath}
						onFileEditContentInput={app.setFileEditContent}
						onSubmitFileEdit={app.submitWorkspaceFileEdit}
						onOpenSettings={() => vscode?.postMessage({ type: 'open-settings-panel' })}
					/>
			) : (
				<SettingsView
					bootstrapState={app.bootstrapState}
					editor={app.editor}
					settings={app.settings}
					settingsNavigation={app.settingsNavigation}
					activeSettingsPanel={app.activeSettingsPanel}
					onOpenSettings={app.openSettings}
					onOpenProviderEditor={app.openProviderEditor}
					onOpenModelEditor={app.openModelEditor}
					onCloseEditor={app.closeEditor}
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
