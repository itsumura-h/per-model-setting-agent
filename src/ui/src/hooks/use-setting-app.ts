import { useEffect, useState } from 'preact/hooks';

import {
	createErrorWorkspaceExecutionState,
	createIdleWorkspaceExecutionState,
	createRunningWorkspaceExecutionState,
	createSuccessWorkspaceExecutionState,
	getConfigurationIssues,
	getSelectedModel,
	getSelectedProvider,
	modelPresets,
	normalizeSettingConfig,
	type ModelConfig,
	type ProviderConfig,
	type ProviderPresetId,
	type SettingConfig,
	type WorkspaceExecutionState,
} from '../../../core/index';
import {
	createProviderDraft,
	formatHeadersText,
	getProviderPreset,
	makeModelEditorDraft,
	makeProviderEditorDraft,
	parseHeadersText,
} from '../lib/editor';
import type {
	EditorState,
	ExtensionMessage,
	ExtensionState,
	SettingsNavigationEntry,
	SettingsSection,
	VsCodeApi,
} from '../types';

type UseSettingAppParams = {
	initialState: ExtensionState;
	vscode?: VsCodeApi;
};

export function useSettingApp({ initialState, vscode }: UseSettingAppParams) {
	const [bootstrapState, setBootstrapState] = useState<ExtensionState>(initialState);
	const [setting, setSetting] = useState<SettingConfig>(initialState.setting);
	const [workspaceExecution, setWorkspaceExecution] = useState<WorkspaceExecutionState>(
		initialState.workspaceExecution ?? createIdleWorkspaceExecutionState(initialState.setting),
	);
	const [surface] = useState<'workspace' | 'settings'>(initialState.surface ?? 'workspace');
	const [settingsSection, setSettingsSection] = useState<SettingsSection>('general');
	const [prompt, setPrompt] = useState('設定メニューの読み込みと CRUD を確認します。');
	const [editor, setEditor] = useState<EditorState | null>(null);
	const [syncStatus, setSyncStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>(
		initialState.loadMode === 'corrupt' ? 'error' : initialState.loadMode === 'default' ? 'idle' : 'saved',
	);
	const [syncMessage, setSyncMessage] = useState(initialState.message);

	useEffect(() => {
		const handler = (event: MessageEvent<ExtensionMessage>) => {
			const message = event.data;

			if (message.type === 'state-saved') {
				setBootstrapState(message.state);
				setSetting(message.state.setting);
				setWorkspaceExecution(message.state.workspaceExecution ?? createIdleWorkspaceExecutionState(message.state.setting));
				setSyncStatus('saved');
				setSyncMessage(message.state.message);
				return;
			}

			if (message.type === 'state-error') {
				setSyncStatus('error');
				setSyncMessage(message.message);
				return;
			}

			if (message.type === 'workspace-execution-state') {
				setWorkspaceExecution(message.state);
				setBootstrapState((current) => ({
					...current,
					workspaceExecution: message.state,
					message:
						message.state.status === 'running'
							? 'Agent を実行しています。'
							: message.state.status === 'success'
								? 'Agent の応答を受信しました。'
								: message.state.status === 'error'
									? 'Agent の実行に失敗しました。'
									: current.message,
					errorMessage: message.state.status === 'error' ? message.state.errorMessage : undefined,
				}));
			}
		};

		window.addEventListener('message', handler);
		vscode?.postMessage({ type: 'request-state' });

		return () => window.removeEventListener('message', handler);
	}, [vscode]);

	const selectedProvider = getSelectedProvider(setting);
	const selectedModel = getSelectedModel(setting);
	const configurationIssues = getConfigurationIssues(setting);

	function persistSetting(nextSetting: SettingConfig) {
		const normalized = normalizeSettingConfig(nextSetting);
		setSetting(normalized);
		setBootstrapState((current) => ({
			...current,
			setting: normalized,
			workspaceExecution: current.workspaceExecution?.status === 'running' ? current.workspaceExecution : createIdleWorkspaceExecutionState(normalized),
			message: '設定を保存しています。',
			errorMessage: undefined,
		}));
		setWorkspaceExecution((current) =>
			current.status === 'running' ? current : createIdleWorkspaceExecutionState(normalized),
		);
		setSyncStatus('saving');
		setSyncMessage('設定を保存しています。');

		if (vscode) {
			vscode.postMessage({
				type: 'save-state',
				setting: normalized,
			});
			return;
		}

		setSyncStatus('saved');
		setSyncMessage('ローカルプレビューを更新しました。');
		setBootstrapState((current) => ({
			...current,
			setting: normalized,
			workspaceExecution: current.workspaceExecution?.status === 'running' ? current.workspaceExecution : createIdleWorkspaceExecutionState(normalized),
			message: 'ローカルプレビューを更新しました。',
			errorMessage: undefined,
		}));
	}

	function updateSelection(nextSetting: SettingConfig) {
		persistSetting(normalizeSettingConfig(nextSetting));
	}

	function selectModel(modelId: string) {
		const nextModel = setting.models.find((model) => model.id === modelId);

		updateSelection({
			...setting,
			selectedProviderId: nextModel?.providerId ?? setting.selectedProviderId,
			selectedModelId: modelId,
		});
	}

	function runAgent() {
		const trimmedPrompt = prompt.trim();
		if (trimmedPrompt.length === 0) {
			setWorkspaceExecution(createIdleWorkspaceExecutionState(setting));
			return;
		}

		const normalizedSetting = normalizeSettingConfig(setting);
		const runningState = createRunningWorkspaceExecutionState(normalizedSetting, trimmedPrompt);
		setWorkspaceExecution(runningState);
		setBootstrapState((current) => ({
			...current,
			setting: normalizedSetting,
			workspaceExecution: runningState,
			message: 'Agent を実行しています。',
			errorMessage: undefined,
		}));

		if (vscode) {
			vscode.postMessage({
				type: 'run-workspace-agent',
				setting: normalizedSetting,
				prompt: trimmedPrompt,
			});
			return;
		}

		const configurationIssues = getConfigurationIssues(normalizedSetting);
		if (configurationIssues.length > 0) {
			const errorState = createErrorWorkspaceExecutionState(
				normalizedSetting,
				trimmedPrompt,
				configurationIssues.join('\n'),
			);
			setWorkspaceExecution(errorState);
			setBootstrapState((current) => ({
				...current,
				workspaceExecution: errorState,
				message: '設定を確認してください。',
				errorMessage: errorState.errorMessage,
			}));
			return;
		}

		const previewResponse = `${selectedProvider?.name ?? 'Provider'} / ${selectedModel?.name ?? 'Model'} に "${trimmedPrompt}" を送信するローカルプレビューです。`;
		const successState = createSuccessWorkspaceExecutionState(normalizedSetting, trimmedPrompt, previewResponse);
		setWorkspaceExecution(successState);
		setBootstrapState((current) => ({
			...current,
			workspaceExecution: successState,
			message: 'ローカルプレビューで応答を表示しました。',
			errorMessage: undefined,
		}));
	}

	function openProviderEditor(provider?: ProviderConfig) {
		setEditor(makeProviderEditorDraft(provider));
		setSettingsSection('provider');
	}

	function openModelEditor(model?: ModelConfig) {
		const providerId = setting.selectedProviderId || setting.providers[0]?.id || '';
		setEditor(makeModelEditorDraft(model, providerId, setting.providers));
		setSettingsSection('model');
	}

	function closeEditor() {
		setEditor(null);
	}

	function saveProviderDraft() {
		if (!editor || editor.kind !== 'provider') {
			return;
		}

		if (editor.draft.name.trim().length === 0) {
			setEditor({
				...editor,
				errorMessage: 'Provider 名は必須です。',
			});
			return;
		}

		if (editor.draft.baseUrl.trim().length === 0) {
			setEditor({
				...editor,
				errorMessage: 'Base URL は必須です。',
			});
			return;
		}

		try {
			const headers = parseHeadersText(editor.headersText);
			const nextProvider = {
				...editor.draft,
				headers,
			};
			const nextProviders =
				editor.mode === 'create'
					? [...setting.providers.filter((entry) => entry.id !== nextProvider.id), nextProvider]
					: setting.providers.map((entry) => (entry.id === nextProvider.id ? nextProvider : entry));

			persistSetting({
				...setting,
				providers: nextProviders,
				selectedProviderId: nextProvider.id,
				selectedModelId: setting.selectedModelId,
			});
			setEditor(null);
		} catch (error) {
			setEditor({
				...editor,
				errorMessage: error instanceof Error ? error.message : String(error),
			});
		}
	}

	function saveModelDraft() {
		if (!editor || editor.kind !== 'model') {
			return;
		}

		if (editor.draft.providerId.trim().length === 0) {
			setEditor({
				...editor,
				errorMessage: 'Provider の選択は必須です。',
			});
			return;
		}

		if (editor.draft.name.trim().length === 0) {
			setEditor({
				...editor,
				errorMessage: 'Model 名は必須です。',
			});
			return;
		}

		if (editor.draft.modelId.trim().length === 0) {
			setEditor({
				...editor,
				errorMessage: 'Model ID は必須です。',
			});
			return;
		}

		const nextModel = editor.draft;
		const nextModels =
			editor.mode === 'create'
				? [...setting.models.filter((entry) => entry.id !== nextModel.id), nextModel]
				: setting.models.map((entry) => (entry.id === nextModel.id ? nextModel : entry));

		persistSetting({
			...setting,
			models: nextModels,
			selectedProviderId: nextModel.providerId,
			selectedModelId: nextModel.id,
		});
		setEditor(null);
	}

	function deleteProvider(providerId: string) {
		const provider = setting.providers.find((entry) => entry.id === providerId);
		if (!provider) {
			return;
		}

		const nextProviders = setting.providers.filter((entry) => entry.id !== providerId);
		const nextModels = setting.models.filter((entry) => entry.providerId !== providerId);
		const nextSelection = resolveSelectionAfterMutation({
			nextProviders,
			nextModels,
			previousProviderId: setting.selectedProviderId,
			previousModelId: setting.selectedModelId,
		});
		persistSetting({
			...setting,
			providers: nextProviders,
			models: nextModels,
			...nextSelection,
		});

		if (editor?.kind === 'provider' && editor.draft.id === providerId) {
			closeEditor();
		}
	}

	function deleteModel(modelId: string) {
		const model = setting.models.find((entry) => entry.id === modelId);
		if (!model) {
			return;
		}

		const nextModels = setting.models.filter((entry) => entry.id !== modelId);
		const nextSelection = resolveSelectionAfterMutation({
			nextProviders: setting.providers,
			nextModels,
			previousProviderId: setting.selectedProviderId,
			previousModelId: setting.selectedModelId,
		});
		persistSetting({
			...setting,
			models: nextModels,
			...nextSelection,
		});

		if (editor?.kind === 'model' && editor.draft.id === modelId) {
			closeEditor();
		}
	}

	function setProviderDraftPreset(presetId: ProviderPresetId | 'custom') {
		if (!editor || editor.kind !== 'provider') {
			return;
		}

		const nextDraft = createProviderDraft(presetId);
		setEditor({
			...editor,
			draft: {
				...editor.draft,
				presetId: nextDraft.presetId,
				name: nextDraft.name,
				baseUrl: nextDraft.baseUrl,
				description: nextDraft.description,
				headers: { ...nextDraft.headers },
			},
			headersText: formatHeadersText(nextDraft.headers),
			errorMessage: undefined,
		});
	}

	function setModelProviderId(nextProviderId: string) {
		if (!editor || editor.kind !== 'model') {
			return;
		}

		const provider = setting.providers.find((entry) => entry.id === nextProviderId);
		const providerPresetId = provider?.presetId;
		const presetModel =
			providerPresetId && providerPresetId !== 'custom'
				? modelPresets.find((entry) => entry.providerId === providerPresetId)
				: modelPresets.find((entry) => entry.providerId === nextProviderId);

		setEditor({
			...editor,
			draft: {
				...editor.draft,
				providerId: nextProviderId,
				name: editor.mode === 'create' ? presetModel?.name ?? editor.draft.name : editor.draft.name,
				modelId: editor.mode === 'create' ? presetModel?.modelId ?? editor.draft.modelId : editor.draft.modelId,
				description: editor.mode === 'create' ? presetModel?.description ?? editor.draft.description : editor.draft.description,
			},
			errorMessage: undefined,
		});
	}

	function updateProviderEditorDraft(patch: Partial<ProviderConfig>) {
		if (!editor || editor.kind !== 'provider') {
			return;
		}

		setEditor({
			...editor,
			draft: {
				...editor.draft,
				...patch,
			},
			errorMessage: undefined,
		});
	}

	function updateProviderHeadersText(headersText: string) {
		if (!editor || editor.kind !== 'provider') {
			return;
		}

		setEditor({
			...editor,
			headersText,
			errorMessage: undefined,
		});
	}

	function updateModelEditorDraft(patch: Partial<ModelConfig>) {
		if (!editor || editor.kind !== 'model') {
			return;
		}

		setEditor({
			...editor,
			draft: {
				...editor.draft,
				...patch,
			},
			errorMessage: undefined,
		});
	}

	function openSettings(section: SettingsSection = 'general') {
		setSettingsSection(section);
	}

	function returnToWorkspace() {
		setEditor(null);
		vscode?.postMessage({ type: 'open-main-panel' });
	}

	const settingSummary = [
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
		setting,
		surface,
		settingsSection,
		prompt,
		workspaceExecution,
		editor,
		syncStatus,
		syncMessage,
		selectedProvider,
		selectedModel,
		configurationIssues,
		settingSummary,
		settingsNavigation,
		activeSettingsPanel: settingsSection,
		setPrompt,
		selectModel,
		runAgent,
		retryAgent: runAgent,
		openProviderEditor,
		openModelEditor,
		closeEditor,
		saveProviderDraft,
		saveModelDraft,
		deleteProvider,
		deleteModel,
		setProviderDraftPreset,
		setModelProviderId,
		updateProviderEditorDraft,
		updateProviderHeadersText,
		updateModelEditorDraft,
		openSettings,
		returnToWorkspace,
		getProviderPreset,
	};
}

function resolveSelectionAfterMutation({
	nextProviders,
	nextModels,
	previousProviderId,
	previousModelId,
}: {
	nextProviders: SettingConfig['providers'];
	nextModels: SettingConfig['models'];
	previousProviderId: string;
	previousModelId: string;
}) {
	const selectedProviderHasModels = nextModels.some((model) => model.providerId === previousProviderId);
	if (selectedProviderHasModels) {
		const selectedProviderModels = nextModels.filter((model) => model.providerId === previousProviderId);
		const selectedModelId = selectedProviderModels.some((model) => model.id === previousModelId)
			? previousModelId
			: selectedProviderModels[0]?.id ?? '';

		return {
			selectedProviderId: previousProviderId,
			selectedModelId,
		};
	}

	const firstModel = nextModels[0];
	if (firstModel) {
		return {
			selectedProviderId: firstModel.providerId,
			selectedModelId: firstModel.id,
		};
	}

	return {
		selectedProviderId: nextProviders[0]?.id ?? '',
		selectedModelId: '',
	};
}
