import {
	modelPresets,
	normalizeSettingsConfig,
	remapWorkspaceExecutionForSetting,
	resolveSelectionAfterMutation,
	createIdleWorkspaceExecutionState,
	type AppState,
	type ModelConfig,
	type ProviderConfig,
	type ProviderPresetId,
	type SettingsConfig,
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
import type { FormEditorState, SettingsSection, VsCodeApi } from '../types';

export type UseSettingsCrudParams = {
	vscode?: VsCodeApi;
	settings: SettingsConfig;
	setSettings: (value: SettingsConfig) => void;
	workspaceExecution: WorkspaceExecutionState;
	setWorkspaceExecution: (value: WorkspaceExecutionState | ((current: WorkspaceExecutionState) => WorkspaceExecutionState)) => void;
	setBootstrapState: (value: AppState | ((current: AppState) => AppState)) => void;
	setSaveStatus: (value: 'idle' | 'saving' | 'saved' | 'error') => void;
	setStatusMessage: (value: string) => void;
	editor: FormEditorState | null;
	setEditor: (value: FormEditorState | null) => void;
	setSettingsSection: (value: SettingsSection) => void;
};

export function useSettingsCrud({
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
}: UseSettingsCrudParams) {
	function commitSettings(nextSettings: SettingsConfig) {
		const normalized = normalizeSettingsConfig(nextSettings);
		const nextWorkspaceExecution = remapWorkspaceExecutionForSetting(workspaceExecution, normalized);
		setSettings(normalized);
		setBootstrapState((current) => ({
			...current,
			settings: normalized,
			workspaceExecution: remapWorkspaceExecutionForSetting(
				current.workspaceExecution ?? createIdleWorkspaceExecutionState(normalized),
				normalized,
			),
			statusMessage: '設定を保存しています。',
			errorMessage: undefined,
		}));
		setWorkspaceExecution(nextWorkspaceExecution);
		setSaveStatus('saving');
		setStatusMessage('設定を保存しています。');

		if (vscode) {
			vscode.postMessage({
				type: 'save-state',
				settings: normalized,
			});
			return;
		}

		setSaveStatus('saved');
		setStatusMessage('ローカルプレビューを更新しました。');
		setBootstrapState((current) => ({
			...current,
			settings: normalized,
			workspaceExecution: remapWorkspaceExecutionForSetting(
				current.workspaceExecution ?? createIdleWorkspaceExecutionState(normalized),
				normalized,
			),
			statusMessage: 'ローカルプレビューを更新しました。',
			errorMessage: undefined,
		}));
	}

	function commitSelection(nextSettings: SettingsConfig) {
		commitSettings(normalizeSettingsConfig(nextSettings));
	}

	function selectModel(modelId: string) {
		const nextModel = settings.models.find((model) => model.id === modelId);

		commitSelection({
			...settings,
			selectedProviderId: nextModel?.providerId ?? settings.selectedProviderId,
			selectedModelId: modelId,
		});
	}

	function openProviderEditor(provider?: ProviderConfig) {
		setEditor(makeProviderEditorDraft(provider));
		setSettingsSection('provider');
	}

	function openModelEditor(model?: ModelConfig) {
		const providerId = settings.selectedProviderId || settings.providers[0]?.id || '';
		setEditor(makeModelEditorDraft(model, providerId, settings.providers));
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
					? [...settings.providers.filter((entry) => entry.id !== nextProvider.id), nextProvider]
					: settings.providers.map((entry) => (entry.id === nextProvider.id ? nextProvider : entry));

			commitSettings({
				...settings,
				providers: nextProviders,
				selectedProviderId: nextProvider.id,
				selectedModelId: settings.selectedModelId,
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
				? [...settings.models.filter((entry) => entry.id !== nextModel.id), nextModel]
				: settings.models.map((entry) => (entry.id === nextModel.id ? nextModel : entry));

		commitSettings({
			...settings,
			models: nextModels,
			selectedProviderId: nextModel.providerId,
			selectedModelId: nextModel.id,
		});
		setEditor(null);
	}

	function deleteProvider(providerId: string) {
		const provider = settings.providers.find((entry) => entry.id === providerId);
		if (!provider) {
			return;
		}

		const nextProviders = settings.providers.filter((entry) => entry.id !== providerId);
		const nextModels = settings.models.filter((entry) => entry.providerId !== providerId);
		const nextSelection = resolveSelectionAfterMutation({
			nextProviders,
			nextModels,
			previousProviderId: settings.selectedProviderId,
			previousModelId: settings.selectedModelId,
		});
		commitSettings({
			...settings,
			providers: nextProviders,
			models: nextModels,
			...nextSelection,
		});

		if (editor?.kind === 'provider' && editor.draft.id === providerId) {
			closeEditor();
		}
	}

	function deleteModel(modelId: string) {
		const model = settings.models.find((entry) => entry.id === modelId);
		if (!model) {
			return;
		}

		const nextModels = settings.models.filter((entry) => entry.id !== modelId);
		const nextSelection = resolveSelectionAfterMutation({
			nextProviders: settings.providers,
			nextModels,
			previousProviderId: settings.selectedProviderId,
			previousModelId: settings.selectedModelId,
		});
		commitSettings({
			...settings,
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

		const provider = settings.providers.find((entry) => entry.id === nextProviderId);
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

	return {
		commitSettings,
		selectModel,
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
