import { useState } from 'preact/hooks';

import {
	createIdleAgentToolFileEditState,
	createIdleWorkspaceExecutionState,
	getConfigurationIssues,
	getSelectedModelStrict,
	getSelectedProvider,
	type AgentToolFileEditState,
	type SettingsConfig,
	type WorkspaceExecutionState,
} from '../../../core/index';
import type { AppState, FormEditorState, SettingsNavigationEntry, SettingsSection, VsCodeApi } from '../types';
import { useAgentToolFileEdit } from './use-agent-tool-file-edit';
import { useExtensionMessaging } from './use-extension-messaging';
import { useSettingsCrud } from './use-settings-crud';
import { useWorkspaceAgent } from './use-workspace-agent';

type UseSettingsAppParams = {
	initialState: AppState;
	vscode?: VsCodeApi;
};

export function useSettingsApp({ initialState, vscode }: UseSettingsAppParams) {
	const [bootstrapState, setBootstrapState] = useState<AppState>(initialState);
	const [settings, setSettings] = useState<SettingsConfig>(initialState.settings);
	const [workspaceExecution, setWorkspaceExecution] = useState<WorkspaceExecutionState>(
		initialState.workspaceExecution ?? createIdleWorkspaceExecutionState(initialState.settings),
	);
	const [agentToolFileEdit, setAgentToolFileEdit] = useState<AgentToolFileEditState>(
		initialState.agentToolFileEdit ?? createIdleAgentToolFileEditState(),
	);
	const [viewMode] = useState<'workspace' | 'settings'>(initialState.viewMode ?? 'workspace');
	const [settingsSection, setSettingsSection] = useState<SettingsSection>('general');
	const [prompt, setPrompt] = useState('');
	const [fileEditRelativePath, setFileEditRelativePath] = useState(initialState.agentToolFileEdit?.relativePath ?? '');
	const [fileEditContent, setFileEditContent] = useState(initialState.agentToolFileEdit?.content ?? '');
	const [editor, setEditor] = useState<FormEditorState | null>(null);
	const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
		initialState.loadStatus === 'corrupt' ? 'error' : initialState.loadStatus === 'fallback' ? 'idle' : 'saved',
	);
	const [statusMessage, setStatusMessage] = useState(initialState.statusMessage);

	useExtensionMessaging({
		vscode,
		settings,
		setBootstrapState,
		setSettings,
		setWorkspaceExecution,
		setAgentToolFileEdit,
		setSaveStatus,
		setStatusMessage,
	});

	const crud = useSettingsCrud({
		vscode,
		settings,
		setSettings,
		workspaceExecution,
		setWorkspaceExecution,
		setBootstrapState,
		setSaveStatus,
		setStatusMessage,
		editor,
		setEditor,
		setSettingsSection,
	});

	const { runAgent } = useWorkspaceAgent({
		vscode,
		settings,
		setSettings,
		workspaceExecution,
		setWorkspaceExecution,
		setBootstrapState,
		prompt,
		setPrompt,
		selectedProvider: getSelectedProvider(settings),
		selectedModel: getSelectedModelStrict(settings),
	});

	const { submitAgentToolFileEdit } = useAgentToolFileEdit({
		vscode,
		fileEditRelativePath,
		fileEditContent,
		setAgentToolFileEdit,
		setBootstrapState,
	});

	const selectedProvider = getSelectedProvider(settings);
	const selectedModel = getSelectedModelStrict(settings);
	const configurationIssues = getConfigurationIssues(settings);

	const settingsSummary = [
		selectedProvider ? `Provider: ${selectedProvider.name}` : 'Provider: 未選択',
		selectedModel ? `Model: ${selectedModel.name}` : 'Model: 未選択',
		bootstrapState.filePath,
	];

	const settingsNavigation: SettingsNavigationEntry[] = [
		{ key: 'general', label: 'general', icon: '◻', panel: 'general' },
		{ key: 'provider', label: 'provider', icon: '◫', panel: 'provider' },
		{ key: 'model', label: 'model', icon: '◌', panel: 'model' },
	];

	return {
		bootstrapState,
		settings,
		viewMode,
		settingsSection,
		prompt,
		workspaceExecution,
		agentToolFileEdit,
		editor,
		saveStatus,
		statusMessage,
		selectedProvider,
		selectedModel,
		configurationIssues,
		settingsSummary,
		settingsNavigation,
		activeSettingsPanel: settingsSection,
		setPrompt,
		fileEditRelativePath,
		fileEditContent,
		setFileEditRelativePath,
		setFileEditContent,
		selectModel: crud.selectModel,
		runAgent,
		submitAgentToolFileEdit,
		openProviderEditor: crud.openProviderEditor,
		openModelEditor: crud.openModelEditor,
		closeEditor: crud.closeEditor,
		saveProviderDraft: crud.saveProviderDraft,
		saveModelDraft: crud.saveModelDraft,
		deleteProvider: crud.deleteProvider,
		deleteModel: crud.deleteModel,
		setProviderDraftPreset: crud.setProviderDraftPreset,
		setModelProviderId: crud.setModelProviderId,
		updateProviderEditorDraft: crud.updateProviderEditorDraft,
		updateProviderHeadersText: crud.updateProviderHeadersText,
		updateModelEditorDraft: crud.updateModelEditorDraft,
		openSettings: crud.openSettings,
		returnToWorkspace: crud.returnToWorkspace,
		getProviderPreset: crud.getProviderPreset,
	};
}
