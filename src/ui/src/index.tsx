import { render } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';

import {
	createDefaultSettingConfig,
	createRunPreview,
	getConfigurationIssues,
	getProviderModels,
	getSelectedModel,
	getSelectedProvider,
	modelPresets,
	providerPresets,
	normalizeSettingConfig,
	type ModelConfig,
	type ProviderConfig,
	type ProviderPresetId,
	type SettingConfig,
} from '../../core/index';
import './style.css';

type ExtensionState = {
	surface: 'workspace' | 'settings';
	setting: SettingConfig;
	filePath: string;
	loadMode: 'default' | 'loaded' | 'corrupt';
	message: string;
	errorMessage?: string;
	lastSavedAt?: string;
};

type EditorState =
	| {
			kind: 'provider';
			mode: 'create' | 'edit';
			draft: ProviderConfig;
			headersText: string;
			errorMessage?: string;
	  }
	| {
			kind: 'model';
			mode: 'create' | 'edit';
			draft: ModelConfig;
			errorMessage?: string;
	  };

type ExtensionMessage =
	| {
			type: 'state-saved';
			state: ExtensionState;
	  }
	| {
			type: 'state-error';
			message: string;
	  };

type VsCodeApi = {
	postMessage(message: unknown): void;
	setState(state: unknown): void;
	getState<T>(): T | undefined;
};

declare const acquireVsCodeApi: undefined | (() => VsCodeApi);

const fallbackBootstrapState: ExtensionState = {
	surface: 'workspace',
	setting: createDefaultSettingConfig(),
	filePath: '~/.permosa/setting.json',
	loadMode: 'default',
	message: 'ローカルプレビューを表示しています。',
};

const initialState = readBootstrapState();
const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : undefined;

function createId(prefix: string) {
	const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
	return `${prefix}-${suffix}`;
}

function readBootstrapState(): ExtensionState {
	const element = document.getElementById('permosa-initial-state');
	const raw = element?.textContent?.trim();

	if (raw) {
		try {
			const parsed = JSON.parse(raw) as ExtensionState;
			if (parsed?.setting) {
				return {
					...parsed,
					surface: parsed.surface ?? 'workspace',
					setting: normalizeSettingConfig(parsed.setting),
				};
			}
		} catch {
			// fall through to fallback state
		}
	}

	return fallbackBootstrapState;
}

function formatHeadersText(headers: Record<string, string>) {
	return JSON.stringify(headers, null, 2);
}

function parseHeadersText(text: string) {
	const trimmed = text.trim();

	if (trimmed.length === 0) {
		return {};
	}

	const parsed = JSON.parse(trimmed) as unknown;
	if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
		throw new Error('headers は JSON オブジェクトで入力してください。');
	}

	return Object.fromEntries(
		Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, typeof value === 'string' ? value : String(value ?? '')]),
	);
}

function createProviderDraft(presetId: ProviderPresetId | 'custom' = 'cometapi'): ProviderConfig {
	if (presetId === 'custom') {
		return {
			id: createId('provider'),
			presetId: 'custom',
			name: '',
			baseUrl: '',
			apiKey: '',
			enabled: true,
			description: '',
			headers: {},
		};
	}

	const preset = providerPresets.find((entry) => entry.id === presetId) ?? providerPresets[0];

	return {
		id: createId('provider'),
		presetId: preset.id,
		name: preset.name,
		baseUrl: preset.baseUrl,
		apiKey: '',
		enabled: true,
		description: preset.description,
		headers: { ...preset.defaultHeaders },
	};
}

function createModelDraft(providerId: string, providers: ProviderConfig[] = initialState.setting.providers): ModelConfig {
	const providerPresetId = providers.find((entry) => entry.id === providerId)?.presetId;
	const preset =
		providerPresetId && providerPresetId !== 'custom'
			? modelPresets.find((entry) => entry.providerId === providerPresetId) ?? modelPresets.find((entry) => entry.providerId === providerId)
			: modelPresets.find((entry) => entry.providerId === providerId);

	return {
		id: createId('model'),
		providerId,
		name: preset?.name ?? '新しいモデル',
		modelId: preset?.modelId ?? '',
		enabled: true,
		description: preset?.description ?? '',
	};
}

function createProviderDraftFromCurrent(provider: ProviderConfig) {
	return {
		...provider,
		apiKey: provider.apiKey ?? '',
		headers: { ...provider.headers },
	};
}

function createModelDraftFromCurrent(model: ModelConfig) {
	return { ...model };
}

function getProviderPreset(provider: ProviderConfig) {
	if (provider.presetId === 'cometapi' || provider.presetId === 'openrouter') {
		return providerPresets.find((entry) => entry.id === provider.presetId);
	}

	return undefined;
}

function makeProviderEditorDraft(provider?: ProviderConfig): EditorState {
	const draft = provider ? createProviderDraftFromCurrent(provider) : createProviderDraft();

	return {
		kind: 'provider',
		mode: provider ? 'edit' : 'create',
		draft,
		headersText: formatHeadersText(draft.headers),
	};
}

function makeModelEditorDraft(model?: ModelConfig, providerId?: string, providers: ProviderConfig[] = initialState.setting.providers): EditorState {
	const draft = model ? createModelDraftFromCurrent(model) : createModelDraft(providerId ?? initialState.setting.selectedProviderId, providers);

	return {
		kind: 'model',
		mode: model ? 'edit' : 'create',
		draft,
	};
}

function App() {
	const [bootstrapState, setBootstrapState] = useState<ExtensionState>(initialState);
	const [setting, setSetting] = useState<SettingConfig>(initialState.setting);
	const [surface] = useState<'workspace' | 'settings'>(initialState.surface ?? 'workspace');
	const [settingsSection, setSettingsSection] = useState<'general' | 'provider' | 'model'>('general');
	const [prompt, setPrompt] = useState('設定メニューの読み込みと CRUD を確認します。');
	const [hasRunPreview, setHasRunPreview] = useState(false);
	const [runResult, setRunResult] = useState(() => createRunPreview({ setting: initialState.setting, prompt: '設定メニューの読み込みと CRUD を確認します。' }));
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
				setSyncStatus('saved');
				setSyncMessage(message.state.message);
				return;
			}

			if (message.type === 'state-error') {
				setSyncStatus('error');
				setSyncMessage(message.message);
			}
		};

		window.addEventListener('message', handler);
		vscode?.postMessage({ type: 'request-state' });

		return () => window.removeEventListener('message', handler);
	}, []);

	useEffect(() => {
		if (!hasRunPreview) {
			return;
		}

		setRunResult(createRunPreview({ setting, prompt }));
	}, [setting, prompt, hasRunPreview]);

	const selectedProvider = getSelectedProvider(setting);
	const selectedModel = getSelectedModel(setting);
	const providerModels = useMemo(() => getProviderModels(setting, setting.selectedProviderId), [setting]);
	const configurationIssues = getConfigurationIssues(setting);

	function persistSetting(nextSetting: SettingConfig) {
		const normalized = normalizeSettingConfig(nextSetting);
		setSetting(normalized);
		setBootstrapState((current) => ({
			...current,
			setting: normalized,
			message: '設定を保存しています。',
			errorMessage: undefined,
		}));
		setSyncStatus('saving');
		setSyncMessage('設定を保存しています。');

		if (vscode) {
			vscode.postMessage({
				type: 'save-state',
				setting: normalized,
			});
		} else {
			setSyncStatus('saved');
			setSyncMessage('ローカルプレビューを更新しました。');
			setBootstrapState((current) => ({
				...current,
				setting: normalized,
				message: 'ローカルプレビューを更新しました。',
				errorMessage: undefined,
			}));
		}
	}

	function updateSelection(nextSetting: SettingConfig) {
		const normalized = normalizeSettingConfig(nextSetting);
		setSetting(normalized);
		persistSetting(normalized);
	}

	function selectProvider(providerId: string) {
		const nextModelId = getProviderModels(setting, providerId)[0]?.id ?? '';
		updateSelection({
			...setting,
			selectedProviderId: providerId,
			selectedModelId: nextModelId,
		});
	}

	function selectModel(modelId: string) {
		updateSelection({
			...setting,
			selectedModelId: modelId,
		});
	}

	function runPreview() {
		setHasRunPreview(true);
		setRunResult(createRunPreview({ setting, prompt }));
	}

	function openProviderEditor(provider?: ProviderConfig) {
		setEditor(makeProviderEditorDraft(provider ?? selectedProvider ?? undefined));
		setSettingsSection('provider');
	}

	function openModelEditor(model?: ModelConfig) {
		setEditor(makeModelEditorDraft(model, setting.selectedProviderId || setting.providers[0]?.id, setting.providers));
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
			const nextProviders = editor.mode === 'create'
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
		const nextModels = editor.mode === 'create'
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

		if (!window.confirm(`Provider「${provider.name}」を削除しますか？関連する Model も削除されます。`)) {
			return;
		}

		const nextProviders = setting.providers.filter((entry) => entry.id !== providerId);
		const nextModels = setting.models.filter((entry) => entry.providerId !== providerId);
		persistSetting({
			...setting,
			providers: nextProviders,
			models: nextModels,
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

		if (!window.confirm(`Model「${model.name}」を削除しますか？`)) {
			return;
		}

		const nextModels = setting.models.filter((entry) => entry.id !== modelId);
		persistSetting({
			...setting,
			models: nextModels,
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
		const presetModel = providerPresetId && providerPresetId !== 'custom'
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

	const settingSummary = [
		selectedProvider ? `Provider: ${selectedProvider.name}` : 'Provider: 未選択',
		selectedModel ? `Model: ${selectedModel.name}` : 'Model: 未選択',
		bootstrapState.filePath,
	];

	const settingsNavigation = [
		{ key: 'general' as const, label: '一般', icon: '≡', description: '概要と状態' },
		{ key: 'provider' as const, label: 'Provider', icon: '◫', description: '接続先の管理' },
		{ key: 'model' as const, label: 'Model', icon: '◌', description: 'モデルの管理' },
	];

	function openSettings(section: 'general' | 'provider' | 'model' = 'general') {
		setSettingsSection(section);
	}

	function returnToWorkspace() {
		setEditor(null);
		vscode?.postMessage({ type: 'open-main-panel' });
	}

	return (
		<main class="app-shell">
			<header class="topbar">
				<div class="brand-block">
					<p class="eyebrow">Per Model Setting Agent</p>
					<h1>設定メニュー付きのメインパネル</h1>
					<p class="brand-copy">
						Provider / Model の選択と CRUD を同じ画面で扱い、`~/.permosa/setting.json` に保存します。
					</p>
				</div>

				<div class="topbar-actions">
					<div class="status-stack">
						<span class={`status-chip status-${syncStatus}`}>{syncStatus}</span>
						<span class="status-note">{syncMessage}</span>
					</div>
					<button
						class="icon-button"
						type="button"
						onClick={() => vscode?.postMessage({ type: 'open-settings-panel' })}
						aria-label="設定を新しいタブで開く"
					>
						⚙
					</button>
				</div>
			</header>

			<section class={`banner banner-${bootstrapState.loadMode}`}>
				<div>
					<p class="banner-title">設定ファイル</p>
					<p class="banner-copy">{bootstrapState.message}</p>
				</div>
				<div class="banner-meta">
					<span>{bootstrapState.filePath}</span>
					{bootstrapState.lastSavedAt ? <span>最終保存: {bootstrapState.lastSavedAt}</span> : null}
				</div>
				{bootstrapState.errorMessage ? <pre class="banner-error">{bootstrapState.errorMessage}</pre> : null}
			</section>

			{surface === 'workspace' ? (
				<section class="workspace-grid">
					<section class="panel">
						<div class="panel-header">
							<div>
								<h2>実行プレビュー</h2>
								<p>現在の Provider / Model を使って、実行前の状態を確認します。</p>
							</div>
							<button class="secondary-button" type="button" onClick={() => vscode?.postMessage({ type: 'open-settings-panel' })}>
								設定を開く
							</button>
						</div>

						<div class="field-grid">
							<label class="field">
								<span>Provider</span>
								<select value={setting.selectedProviderId} onChange={(event) => selectProvider((event.currentTarget as HTMLSelectElement).value)}>
									{setting.providers.length === 0 ? <option value="">Provider を追加してください</option> : null}
									{setting.providers.map((provider) => (
										<option key={provider.id} value={provider.id}>
											{provider.name}
										</option>
									))}
								</select>
							</label>

							<label class="field">
								<span>Model</span>
								<select value={setting.selectedModelId} onChange={(event) => selectModel((event.currentTarget as HTMLSelectElement).value)}>
									{providerModels.length === 0 ? <option value="">Model を追加してください</option> : null}
									{providerModels.map((model) => (
										<option key={model.id} value={model.id}>
											{model.name}
										</option>
									))}
								</select>
							</label>
						</div>

						<label class="field">
							<span>確認メッセージ</span>
							<textarea
								rows={5}
								value={prompt}
								onInput={(event) => setPrompt((event.currentTarget as HTMLTextAreaElement).value)}
								placeholder="設定内容を確認したいメッセージを入力"
							/>
						</label>

						<div class="inline-actions">
							<button class="primary-button" type="button" onClick={runPreview}>
								実行
							</button>
							<button class="secondary-button" type="button" onClick={runPreview}>
								再試行
							</button>
						</div>
					</section>

					<section class="panel result-panel">
						<div class="panel-header">
							<div>
								<h2>結果</h2>
								<p>設定不備がある場合は、ここにガイダンスを表示します。</p>
							</div>
						</div>

						<div class="result-card">
							<div class="result-title-row">
								<h3>{runResult.title}</h3>
								<span class={`status-chip status-${runResult.statusLabel}`}>{runResult.statusLabel}</span>
							</div>
							<p class="result-copy">{runResult.response}</p>
							<div class="result-meta">
								<span>{runResult.providerName}</span>
								<span>{runResult.modelName}</span>
								<span>{runResult.baseUrl}</span>
								<span>{runResult.timestamp}</span>
							</div>
							<div class="result-block">
								<span class="result-label">Prompt</span>
								<pre>{runResult.prompt}</pre>
							</div>
							<div class="result-block">
								<span class="result-label">Checklist</span>
								<ul class="checklist">
									{runResult.checklist.map((item) => (
										<li key={item}>{item}</li>
									))}
								</ul>
							</div>
							{runResult.errorMessage ? (
								<div class="result-block">
									<span class="result-label">Error</span>
									<pre>{runResult.errorMessage}</pre>
								</div>
							) : null}
						</div>

						<div class="result-block">
							<span class="result-label">Configuration</span>
							<ul class="checklist">
								{settingSummary.map((item) => (
									<li key={item}>{item}</li>
								))}
							</ul>
						</div>

						{configurationIssues.length > 0 ? (
							<div class="result-block">
								<span class="result-label">Guidance</span>
								<ul class="checklist">
									{configurationIssues.map((item) => (
										<li key={item}>{item}</li>
									))}
								</ul>
							</div>
						) : null}
					</section>
				</section>
			) : (
				<div class="drawer settings-drawer drawer-open">
					<div class="drawer-content">
						<div class="settings-main">
							<div class="settings-toolbar">
								<div>
									<p class="eyebrow">Codex Settings</p>
									<h2>設定</h2>
									<p>左のメニューでページを切り替え、右側で CRUD を操作します。</p>
								</div>
								<div class="inline-actions">
									<button class="secondary-button" type="button" onClick={returnToWorkspace}>
										実行画面へ戻る
									</button>
								</div>
							</div>

							{settingsSection === 'general' ? (
								<div class="settings-page">
									<div class="settings-page-header">
										<div>
											<h2>一般</h2>
											<p>設定画面の状態と、いま選択されている Provider / Model を確認できます。</p>
										</div>
										<div class="inline-actions">
											<button class="primary-button" type="button" onClick={() => openSettings('provider')}>
												Provider
											</button>
											<button class="secondary-button" type="button" onClick={() => openSettings('model')}>
												Model
											</button>
										</div>
									</div>

									<div class="summary-grid">
										<article class="summary-card">
											<p class="summary-label">保存先</p>
											<h3>{bootstrapState.filePath}</h3>
											<p class="helper-text">{bootstrapState.message}</p>
										</article>
										<article class="summary-card">
											<p class="summary-label">現在の選択</p>
											<h3>{selectedProvider ? selectedProvider.name : '未選択'}</h3>
											<p class="helper-text">{selectedModel ? selectedModel.name : 'Model 未選択'}</p>
										</article>
										<article class="summary-card">
											<p class="summary-label">状態</p>
											<h3>{syncStatus}</h3>
											<p class="helper-text">{syncMessage}</p>
										</article>
									</div>

									<div class="settings-actions">
										<button class="primary-button" type="button" onClick={() => openSettings('provider')}>
											Provider を編集
										</button>
										<button class="secondary-button" type="button" onClick={() => openSettings('model')}>
											Model を編集
										</button>
									</div>
								</div>
							) : null}

							{settingsSection === 'provider' ? (
								<div class="settings-page">
									<div class="settings-page-header">
										<div>
											<h2>Provider</h2>
											<p>Provider を追加・更新・削除できます。選択中の Provider は Model 側にも反映されます。</p>
										</div>
										<div class="inline-actions">
											<button class="primary-button" type="button" onClick={() => openProviderEditor()}>
												Provider を追加
											</button>
											<button class="secondary-button" type="button" onClick={() => openSettings('model')}>
												Model へ
											</button>
										</div>
									</div>

									<div class="settings-page-card">
										<div class="page-card-header">
											<div>
												<h3>Provider 一覧</h3>
												<p>一覧から選択し、右側の CRUD で編集できます。</p>
											</div>
											<div class="inline-actions">
												<button class="primary-button" type="button" onClick={() => openProviderEditor()}>
													Provider を追加
												</button>
												<button class="secondary-button" type="button" onClick={() => openSettings('model')}>
													Model へ
												</button>
											</div>
										</div>

										<div class="entity-list entity-list-scroll">
											{setting.providers.length === 0 ? (
												<div class="empty-state">
													<p>Provider がありません。</p>
													<p class="helper-text">Provider を追加すると Model を作成できるようになります。</p>
												</div>
											) : (
												setting.providers.map((provider) => {
													const preset = getProviderPreset(provider);
													const isSelected = provider.id === setting.selectedProviderId;

													return (
														<article
															key={provider.id}
															class={`entity-card ${isSelected ? 'entity-card-active' : ''}`}
															onClick={() => selectProvider(provider.id)}
														>
															<div class="entity-card-header">
																<div>
																	<h3>{provider.name}</h3>
																	<p>{provider.baseUrl}</p>
																</div>
																<span class={`status-chip ${provider.enabled ? 'status-ready' : 'status-error'}`}>{provider.enabled ? 'enabled' : 'disabled'}</span>
															</div>

															<div class="entity-card-meta">
																<span>{preset ? preset.name : 'Custom'}</span>
																<span>{provider.apiKey?.trim().length ? 'apiKey: set' : 'apiKey: empty'}</span>
															</div>

															{provider.description ? <p class="entity-copy">{provider.description}</p> : null}

															<div class="entity-card-actions">
																<button
																	class="secondary-button"
																	type="button"
																	onClick={(event) => {
																		event.stopPropagation();
																		openProviderEditor(provider);
																	}}
																>
																	編集
																</button>
																<button
																	class="danger-button"
																	type="button"
																	onClick={(event) => {
																		event.stopPropagation();
																		deleteProvider(provider.id);
																	}}
																>
																	削除
																</button>
															</div>
														</article>
													);
												})
											)}
										</div>

										<div class="page-editor-shell">
											<div class="page-card-header">
												<div>
													<h3>Provider CRUD</h3>
													<p>{editor ? `${editor.kind === 'provider' ? 'Provider' : 'Model'} の ${editor.mode === 'create' ? '追加' : '更新'} を行います。` : 'カードを選ぶとここで編集できます。'}</p>
												</div>
												{editor ? (
													<button class="secondary-button" type="button" onClick={closeEditor}>
														閉じる
													</button>
												) : null}
											</div>

											{editor && editor.kind === 'provider' ? (
												<div class="editor-form">
													{editor.errorMessage ? <p class="error-text">{editor.errorMessage}</p> : null}
													<label class="field">
														<span>Preset</span>
														<select value={editor.draft.presetId ?? 'custom'} onChange={(event) => setProviderDraftPreset((event.currentTarget as HTMLSelectElement).value as ProviderPresetId | 'custom')}>
															<option value="custom">Custom</option>
															{providerPresets.map((preset) => (
																<option key={preset.id} value={preset.id}>
																	{preset.name}
																</option>
															))}
														</select>
													</label>
													<div class="field-grid">
														<label class="field">
															<span>Name</span>
															<input value={editor.draft.name} onInput={(event) => setEditor({ ...editor, draft: { ...editor.draft, name: (event.currentTarget as HTMLInputElement).value }, errorMessage: undefined })} />
														</label>
														<label class="field">
															<span>Base URL</span>
															<input value={editor.draft.baseUrl} onInput={(event) => setEditor({ ...editor, draft: { ...editor.draft, baseUrl: (event.currentTarget as HTMLInputElement).value }, errorMessage: undefined })} />
														</label>
													</div>
													<label class="field">
														<span>API Key</span>
														<input type="password" value={editor.draft.apiKey ?? ''} onInput={(event) => setEditor({ ...editor, draft: { ...editor.draft, apiKey: (event.currentTarget as HTMLInputElement).value }, errorMessage: undefined })} />
													</label>
													<label class="field">
														<span>Description</span>
														<textarea rows={3} value={editor.draft.description} onInput={(event) => setEditor({ ...editor, draft: { ...editor.draft, description: (event.currentTarget as HTMLTextAreaElement).value }, errorMessage: undefined })} />
													</label>
													<label class="field">
														<span>Headers JSON</span>
														<textarea rows={5} value={editor.headersText} onInput={(event) => setEditor({ ...editor, headersText: (event.currentTarget as HTMLTextAreaElement).value, errorMessage: undefined })} />
													</label>
													<label class="checkbox-row">
														<input type="checkbox" checked={editor.draft.enabled} onChange={(event) => setEditor({ ...editor, draft: { ...editor.draft, enabled: (event.currentTarget as HTMLInputElement).checked }, errorMessage: undefined })} />
														<span>Enabled</span>
													</label>
													<div class="inline-actions">
														<button class="primary-button" type="button" onClick={saveProviderDraft}>
															保存
														</button>
														<button class="secondary-button" type="button" onClick={closeEditor}>
															キャンセル
														</button>
													</div>
												</div>
											) : (
												<div class="empty-state">
													<p>編集対象を選ぶと、ここで追加・更新できます。</p>
													<p class="helper-text">右側で入力し、保存すると設定ファイルへ反映されます。</p>
												</div>
											)}
										</div>
									</div>
								</div>
							) : null}

							{settingsSection === 'model' ? (
								<div class="settings-page">
									<div class="settings-page-header">
										<div>
											<h2>Model</h2>
											<p>選択中 Provider に紐づく Model を管理します。</p>
										</div>
										<div class="inline-actions">
											<button class="primary-button" type="button" onClick={() => openModelEditor()}>
												Model を追加
											</button>
											<button class="secondary-button" type="button" onClick={() => openSettings('provider')}>
												Provider へ
											</button>
										</div>
									</div>

									<div class="settings-page-card">
										<div class="page-card-header">
											<div>
												<h3>Model 一覧</h3>
												<p>{selectedProvider ? `${selectedProvider.name} に紐づく Model を表示します。` : 'Provider を選ぶと Model を表示できます。'}</p>
											</div>
											<div class="inline-actions">
												<button class="primary-button" type="button" onClick={() => openModelEditor()}>
													Model を追加
												</button>
												<button class="secondary-button" type="button" onClick={() => openSettings('provider')}>
													Provider へ
												</button>
											</div>
										</div>

										<div class="entity-list entity-list-scroll">
											{!selectedProvider ? (
												<div class="empty-state">
													<p>Provider を選択してください。</p>
												</div>
											) : providerModels.length === 0 ? (
												<div class="empty-state">
													<p>この Provider には Model がありません。</p>
													<p class="helper-text">Model を追加して紐づけてください。</p>
												</div>
											) : (
												providerModels.map((model) => {
													const isSelected = model.id === setting.selectedModelId;

													return (
														<article
															key={model.id}
															class={`entity-card ${isSelected ? 'entity-card-active' : ''}`}
															onClick={() => selectModel(model.id)}
														>
															<div class="entity-card-header">
																<div>
																	<h3>{model.name}</h3>
																	<p>{model.modelId}</p>
																</div>
																<span class={`status-chip ${model.enabled ? 'status-ready' : 'status-error'}`}>{model.enabled ? 'enabled' : 'disabled'}</span>
															</div>

															{model.description ? <p class="entity-copy">{model.description}</p> : null}

															<div class="entity-card-actions">
																<button
																	class="secondary-button"
																	type="button"
																	onClick={(event) => {
																		event.stopPropagation();
																		openModelEditor(model);
																	}}
																>
																	編集
																</button>
																<button
																	class="danger-button"
																	type="button"
																	onClick={(event) => {
																		event.stopPropagation();
																		deleteModel(model.id);
																	}}
																>
																	削除
																</button>
															</div>
														</article>
													);
												})
											)}
										</div>

										<div class="page-editor-shell">
											<div class="page-card-header">
												<div>
													<h3>Model CRUD</h3>
													<p>{editor ? `${editor.kind === 'model' ? 'Model' : 'Provider'} の ${editor.mode === 'create' ? '追加' : '更新'} を行います。` : 'カードを選ぶとここで編集できます。'}</p>
												</div>
												{editor ? (
													<button class="secondary-button" type="button" onClick={closeEditor}>
														閉じる
													</button>
												) : null}
											</div>

											{editor && editor.kind === 'model' ? (
												<div class="editor-form">
													{editor.errorMessage ? <p class="error-text">{editor.errorMessage}</p> : null}
													<label class="field">
														<span>Provider</span>
														<select value={editor.draft.providerId} onChange={(event) => setModelProviderId((event.currentTarget as HTMLSelectElement).value)}>
															{setting.providers.length === 0 ? <option value="">Provider を追加してください</option> : null}
															{setting.providers.map((provider) => (
																<option key={provider.id} value={provider.id}>
																	{provider.name}
																</option>
															))}
														</select>
													</label>
													<div class="field-grid">
														<label class="field">
															<span>Name</span>
															<input value={editor.draft.name} onInput={(event) => setEditor({ ...editor, draft: { ...editor.draft, name: (event.currentTarget as HTMLInputElement).value }, errorMessage: undefined })} />
														</label>
														<label class="field">
															<span>Model ID</span>
															<input value={editor.draft.modelId} onInput={(event) => setEditor({ ...editor, draft: { ...editor.draft, modelId: (event.currentTarget as HTMLInputElement).value }, errorMessage: undefined })} />
														</label>
													</div>
													<label class="field">
														<span>Description</span>
														<textarea rows={3} value={editor.draft.description} onInput={(event) => setEditor({ ...editor, draft: { ...editor.draft, description: (event.currentTarget as HTMLTextAreaElement).value }, errorMessage: undefined })} />
													</label>
													<label class="checkbox-row">
														<input type="checkbox" checked={editor.draft.enabled} onChange={(event) => setEditor({ ...editor, draft: { ...editor.draft, enabled: (event.currentTarget as HTMLInputElement).checked }, errorMessage: undefined })} />
														<span>Enabled</span>
													</label>
													<div class="inline-actions">
														<button class="primary-button" type="button" onClick={saveModelDraft}>
															保存
														</button>
														<button class="secondary-button" type="button" onClick={closeEditor}>
															キャンセル
														</button>
													</div>
												</div>
											) : (
												<div class="empty-state">
													<p>編集対象を選ぶと、ここで追加・更新できます。</p>
													<p class="helper-text">選択中の Provider に従属して Model を管理します。</p>
												</div>
											)}
										</div>
									</div>
								</div>
							) : null}
						</div>
					</div>

					<div class="drawer-side">
						<aside class="settings-drawer-panel" aria-label="設定カテゴリ">
							<div class="settings-drawer-brand">
								<p class="settings-drawer-eyebrow">Settings</p>
								<h2>メニュー</h2>
								<p>ページを切り替えて、右側の CRUD を操作します。</p>
							</div>

							<ul class="menu menu-lg settings-menu">
								{settingsNavigation.map((entry) => (
									<li key={entry.key}>
										<button
											class={`settings-menu-item ${settingsSection === entry.key ? 'settings-menu-item-active' : ''}`}
											type="button"
											onClick={() => openSettings(entry.key)}
										>
											<span class="settings-menu-icon">{entry.icon}</span>
											<span class="settings-menu-copy">
												<span class="settings-menu-label">{entry.label}</span>
												<span class="settings-menu-description">{entry.description}</span>
											</span>
										</button>
									</li>
								))}
							</ul>

							<div class="settings-drawer-footer">
								<button class="secondary-button settings-drawer-return" type="button" onClick={returnToWorkspace}>
									メインへ戻る
								</button>
							</div>
						</aside>
					</div>
				</div>
			)}
		</main>
	);
}

render(<App />, document.getElementById('app') as HTMLElement);
