export type ProviderPresetId = 'cometapi' | 'openrouter' | 'custom';

export type ProviderPreset = {
	id: Exclude<ProviderPresetId, 'custom'>;
	name: string;
	baseUrl: string;
	description: string;
	defaultModelId: string;
	defaultHeaders: Record<string, string>;
};

export type ProviderConfig = {
	id: string;
	presetId?: ProviderPresetId;
	name: string;
	baseUrl: string;
	apiKey?: string;
	enabled: boolean;
	description: string;
	headers: Record<string, string>;
};

export type ModelConfig = {
	id: string;
	providerId: string;
	name: string;
	modelId: string;
	enabled: boolean;
	description: string;
};

export type SettingConfig = {
	version: 1;
	selectedProviderId: string;
	selectedModelId: string;
	providers: ProviderConfig[];
	models: ModelConfig[];
};

export type PersistedProviderConfig = Omit<ProviderConfig, 'apiKey'>;

export type PersistedSettingConfig = {
	version: 1;
	selectedProviderId: string;
	selectedModelId: string;
	providers: PersistedProviderConfig[];
	models: ModelConfig[];
};

export type RunPreviewInput = {
	setting: SettingConfig;
	prompt: string;
};

export type RunPreviewResult = {
	title: string;
	statusLabel: 'ready' | 'waiting' | 'error';
	providerName: string;
	modelName: string;
	baseUrl: string;
	prompt: string;
	response: string;
	checklist: string[];
	errorMessage?: string;
	timestamp: string;
};

export type WorkspaceConversationRole = 'system' | 'user' | 'assistant' | 'error';

export type WorkspaceConversationStatus = 'idle' | 'streaming' | 'complete' | 'error';

export type WorkspaceConversationMessage = {
	id: string;
	role: WorkspaceConversationRole;
	title: string;
	content: string;
	status: WorkspaceConversationStatus;
	timestamp: string;
	canRetry: boolean;
};

export type WorkspaceExecutionStatus = 'idle' | 'running' | 'success' | 'error';

export type WorkspaceExecutionState = {
	status: WorkspaceExecutionStatus;
	title: string;
	providerName: string;
	modelName: string;
	baseUrl: string;
	prompt: string;
	response: string;
	messages: WorkspaceConversationMessage[];
	streamingMessageId?: string;
	errorMessage?: string;
	configurationIssues: string[];
	fileEditSafetyNotice: WorkspaceFileEditSafetyNotice;
	timestamp: string;
	canRetry: boolean;
};

export type WorkspaceFileEditSafetyNotice = {
	title: string;
	items: string[];
};

export type WorkspaceFileEditStatus = 'idle' | 'saving' | 'success' | 'error';

export type WorkspaceFileEditState = {
	status: WorkspaceFileEditStatus;
	title: string;
	workspaceRoot: string;
	relativePath: string;
	content: string;
	resultPath?: string;
	errorMessage?: string;
	safetyNotice: WorkspaceFileEditSafetyNotice;
	timestamp: string;
	canRetry: boolean;
};

export const providerPresets: ProviderPreset[] = [
	{
		id: 'cometapi',
		name: 'CometAPI',
		baseUrl: 'https://api.cometapi.com/v1',
		description: 'OpenAI互換の基本確認用プロバイダー',
		defaultModelId: 'deepseek-chat',
		defaultHeaders: {},
	},
	{
		id: 'openrouter',
		name: 'OpenRouter',
		baseUrl: 'https://openrouter.ai/api/v1',
		description: '追加ヘッダー確認も想定したプロバイダー',
		defaultModelId: 'openai/gpt-4.1-mini',
		defaultHeaders: {
			'HTTP-Referer': '',
			'X-Title': '',
		},
	},
];

export const modelPresets: ModelConfig[] = [
	{
		id: 'deepseek-chat',
		name: 'DeepSeek Chat',
		providerId: 'cometapi',
		enabled: true,
		description: 'CometAPI の標準モデル',
		modelId: 'deepseek-chat',
	},
	{
		id: 'deepseek-reasoner',
		name: 'DeepSeek Reasoner',
		providerId: 'cometapi',
		enabled: true,
		description: 'CometAPI の推論系モデル',
		modelId: 'deepseek-reasoner',
	},
	{
		id: 'openai-gpt-4.1-mini',
		name: 'GPT-4.1 Mini',
		providerId: 'openrouter',
		enabled: true,
		description: 'OpenRouter 経由の OpenAI 系モデル',
		modelId: 'openai/gpt-4.1-mini',
	},
	{
		id: 'anthropic-claude-3.5-sonnet',
		name: 'Claude 3.5 Sonnet',
		providerId: 'openrouter',
		enabled: true,
		description: 'OpenRouter 経由の Anthropic 系モデル',
		modelId: 'anthropic/claude-3.5-sonnet',
	},
];

export function createWorkspaceFileEditSafetyNotice(): WorkspaceFileEditSafetyNotice {
	return {
		title: 'ファイル編集前の安全確認',
		items: [
			'対象ファイルを先に明示し、workspace root の外側は編集しない',
			'差分方針は最小差分を基本にし、必要な変更だけを提案する',
			'失敗時の戻し方は、元ファイルの復元または差分の取り消しで案内する',
			'実際の編集前に、内容を確認できる説明を必ず挟む',
		],
	};
}

export function createIdleWorkspaceFileEditState(workspaceRoot = ''): WorkspaceFileEditState {
	return {
		status: 'idle',
		title: '待機中',
		workspaceRoot,
		relativePath: '',
		content: '',
		safetyNotice: createWorkspaceFileEditSafetyNotice(),
		timestamp: new Date().toISOString(),
		canRetry: false,
	};
}

export function createSavingWorkspaceFileEditState(input: {
	workspaceRoot: string;
	relativePath: string;
	content: string;
}) {
	return {
		status: 'saving' as const,
		title: '保存中',
		workspaceRoot: input.workspaceRoot,
		relativePath: input.relativePath,
		content: input.content,
		safetyNotice: createWorkspaceFileEditSafetyNotice(),
		timestamp: new Date().toISOString(),
		canRetry: false,
	};
}

export function createSuccessWorkspaceFileEditState(input: {
	workspaceRoot: string;
	relativePath: string;
	content: string;
	resultPath: string;
}) {
	return {
		status: 'success' as const,
		title: '保存完了',
		workspaceRoot: input.workspaceRoot,
		relativePath: input.relativePath,
		content: input.content,
		resultPath: input.resultPath,
		safetyNotice: createWorkspaceFileEditSafetyNotice(),
		timestamp: new Date().toISOString(),
		canRetry: true,
	};
}

export function createErrorWorkspaceFileEditState(input: {
	workspaceRoot: string;
	relativePath: string;
	content: string;
	errorMessage: string;
}) {
	return {
		status: 'error' as const,
		title: '保存失敗',
		workspaceRoot: input.workspaceRoot,
		relativePath: input.relativePath,
		content: input.content,
		errorMessage: input.errorMessage,
		safetyNotice: createWorkspaceFileEditSafetyNotice(),
		timestamp: new Date().toISOString(),
		canRetry: true,
	};
}

function createId(prefix: string) {
	const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
	return `${prefix}-${suffix}`;
}

function isProviderPresetId(value: string | undefined): value is Exclude<ProviderPresetId, 'custom'> {
	return value === 'cometapi' || value === 'openrouter';
}

function getPresetById(id: Exclude<ProviderPresetId, 'custom'>) {
	return providerPresets.find((entry) => entry.id === id);
}

function normalizeHeaders(input: unknown, fallback: Record<string, string>): Record<string, string> {
	if (!input || typeof input !== 'object' || Array.isArray(input)) {
		return { ...fallback };
	}

	const entries = Object.entries(input as Record<string, unknown>).filter(
		(entry): entry is [string, string] => typeof entry[1] === 'string',
	);
	if (entries.length === 0) {
		return { ...fallback };
	}

	return Object.fromEntries(entries);
}

function normalizeProvider(input: Partial<ProviderConfig>, fallbackPreset?: ProviderPreset): ProviderConfig {
	const presetId = isProviderPresetId(input.presetId) ? input.presetId : fallbackPreset?.id;
	const preset = presetId ? getPresetById(presetId) : undefined;
	const name = typeof input.name === 'string' && input.name.trim().length > 0 ? input.name.trim() : preset?.name ?? '未設定のプロバイダー';
	const baseUrl = typeof input.baseUrl === 'string' && input.baseUrl.trim().length > 0 ? input.baseUrl.trim() : preset?.baseUrl ?? '';
	const description =
		typeof input.description === 'string' && input.description.trim().length > 0
			? input.description.trim()
			: preset?.description ?? '';

	return {
		id: typeof input.id === 'string' && input.id.trim().length > 0 ? input.id.trim() : createId('provider'),
		presetId: presetId ?? undefined,
		name,
		baseUrl,
		apiKey: typeof input.apiKey === 'string' ? input.apiKey : '',
		enabled: typeof input.enabled === 'boolean' ? input.enabled : true,
		description,
		headers: normalizeHeaders(input.headers, preset?.defaultHeaders ?? {}),
	};
}

function normalizeModel(input: Partial<ModelConfig>, providers: ProviderConfig[]) {
	const providerId = typeof input.providerId === 'string' && providers.some((entry) => entry.id === input.providerId) ? input.providerId : providers[0]?.id ?? '';
	const providerPreset = providers.find((entry) => entry.id === providerId)?.presetId;
	const preset = providerPreset && isProviderPresetId(providerPreset) ? providerPresets.find((entry) => entry.id === providerPreset) : undefined;
	const name = typeof input.name === 'string' && input.name.trim().length > 0 ? input.name.trim() : '新しいモデル';

	return {
		id: typeof input.id === 'string' && input.id.trim().length > 0 ? input.id.trim() : createId('model'),
		providerId,
		name,
		modelId:
			typeof input.modelId === 'string' && input.modelId.trim().length > 0
				? input.modelId.trim()
				: preset?.defaultModelId ?? '',
		enabled: typeof input.enabled === 'boolean' ? input.enabled : true,
		description: typeof input.description === 'string' ? input.description.trim() : '',
	};
}

function createDefaultProviders() {
	return providerPresets.map((preset) => normalizeProvider({ presetId: preset.id }, preset));
}

function createDefaultModels(providers: ProviderConfig[]) {
	return modelPresets
		.filter((preset) => providers.some((provider) => provider.presetId === preset.providerId))
		.map((preset) =>
			normalizeModel(
				{
					id: preset.id,
					providerId: preset.providerId,
					name: preset.name,
					modelId: preset.modelId,
					enabled: preset.enabled,
					description: preset.description,
				},
				providers,
			),
		);
}

export function createDefaultSettingConfig(): SettingConfig {
	const providers = createDefaultProviders();
	const models = createDefaultModels(providers);
	const selectedProviderId = providers[0]?.id ?? '';
	const selectedModelId = models.find((entry) => entry.providerId === selectedProviderId)?.id ?? '';

	return {
		version: 1,
		selectedProviderId,
		selectedModelId,
		providers,
		models,
	};
}

export function normalizeSettingConfig(input?: Partial<PersistedSettingConfig> | Partial<SettingConfig> | null): SettingConfig {
	const defaults = createDefaultSettingConfig();
	const providersSource = Array.isArray(input?.providers) ? input.providers : undefined;
	const providers =
		providersSource === undefined
			? defaults.providers
			: providersSource
					.map((entry) => normalizeProvider(entry))
					.filter((entry) => entry.name.length > 0 && entry.baseUrl.length > 0);

	const modelsSource = Array.isArray(input?.models) ? input.models : undefined;
	const rawModels =
		modelsSource === undefined
			? providersSource === undefined
				? defaults.models
				: []
			: modelsSource;
	const models = rawModels
		.map((entry) => normalizeModel(entry, providers))
		.filter((entry) => entry.providerId.length > 0 && providers.some((provider) => provider.id === entry.providerId));

	const selectedProviderId =
		typeof input?.selectedProviderId === 'string' && providers.some((provider) => provider.id === input.selectedProviderId)
			? input.selectedProviderId
			: providers[0]?.id ?? '';
	const selectedProviderModels = models.filter((entry) => entry.providerId === selectedProviderId);
	const selectedModelId =
		typeof input?.selectedModelId === 'string' && selectedProviderModels.some((entry) => entry.id === input.selectedModelId)
			? input.selectedModelId
			: selectedProviderModels[0]?.id ?? '';

	return {
		version: 1,
		selectedProviderId,
		selectedModelId,
		providers,
		models,
	};
}

export function hydrateSettingConfig(
	input?: Partial<PersistedSettingConfig> | Partial<SettingConfig> | null,
	apiKeysByProviderId: Record<string, string> = {},
) {
	const normalized = normalizeSettingConfig(input);

	return {
		...normalized,
		providers: normalized.providers.map((provider) => ({
			...provider,
			apiKey: apiKeysByProviderId[provider.id] ?? provider.apiKey ?? '',
		})),
	};
}

export function serializeSettingConfig(setting: SettingConfig): PersistedSettingConfig {
	return {
		version: 1,
		selectedProviderId: setting.selectedProviderId,
		selectedModelId: setting.selectedModelId,
		providers: setting.providers.map(({ apiKey: _apiKey, ...provider }) => provider),
		models: setting.models.map((model) => ({ ...model })),
	};
}

export function getProviderPresetByProviderId(providerId: string) {
	const provider = providerPresets.find((entry) => entry.id === providerId);
	return provider;
}

export function getProviderModels(setting: SettingConfig, providerId: string) {
	return setting.models.filter((model) => model.providerId === providerId);
}

export function getSelectedProvider(setting: SettingConfig) {
	return setting.providers.find((provider) => provider.id === setting.selectedProviderId);
}

export function getSelectedModel(setting: SettingConfig) {
	return setting.models.find((model) => model.id === setting.selectedModelId && model.providerId === setting.selectedProviderId);
}

export function getWorkspaceSelectedModel(setting: SettingConfig) {
	return setting.models.find((model) => model.id === setting.selectedModelId);
}

export function getWorkspaceSelectedProvider(setting: SettingConfig) {
	const model = getWorkspaceSelectedModel(setting);
	if (model) {
		return setting.providers.find((provider) => provider.id === model.providerId);
	}

	return getSelectedProvider(setting);
}

export function getConfigurationIssues(setting: SettingConfig) {
	const issues: string[] = [];
	const selectedProvider = getSelectedProvider(setting);
	const selectedModel = getSelectedModel(setting);

	if (!selectedProvider) {
		issues.push('選択中のProviderが見つかりません。Provider を追加して選び直してください。');
		return issues;
	}

	if (!selectedProvider.enabled) {
		issues.push('選択中のProviderが無効です。必要であれば有効化してください。');
	}

	if (selectedProvider.baseUrl.trim().length === 0) {
		issues.push('Provider の baseUrl が未設定です。');
	}

	if (selectedProvider.apiKey?.trim().length === 0) {
		issues.push('Provider の API キーが未設定です。');
	}

	if (!selectedModel) {
		issues.push('選択中のModelが見つかりません。Model を追加して選び直してください。');
		return issues;
	}

	if (!selectedModel.enabled) {
		issues.push('選択中のModelが無効です。必要であれば有効化してください。');
	}

	if (selectedModel.modelId.trim().length === 0) {
		issues.push('Model ID が未設定です。');
	}

	return issues;
}

export function getWorkspaceExecutionContext(setting: SettingConfig) {
	const model = getWorkspaceSelectedModel(setting);
	const provider = getWorkspaceSelectedProvider(setting);
	const configurationIssues: string[] = [];

	if (!model) {
		configurationIssues.push('選択中のModelが見つかりません。Model を追加して選び直してください。');
		return {
			provider,
			model,
			configurationIssues,
			isReady: false,
		};
	}

	if (!provider) {
		configurationIssues.push('選択中のModelに紐づくProviderが見つかりません。Provider を追加して選び直してください。');
		return {
			provider,
			model,
			configurationIssues,
			isReady: false,
		};
	}

	if (!provider.enabled) {
		configurationIssues.push('選択中のProviderが無効です。必要であれば有効化してください。');
	}

	if (provider.baseUrl.trim().length === 0) {
		configurationIssues.push('Provider の baseUrl が未設定です。');
	}

	if (provider.apiKey?.trim().length === 0) {
		configurationIssues.push('Provider の API キーが未設定です。');
	}

	if (!model.enabled) {
		configurationIssues.push('選択中のModelが無効です。必要であれば有効化してください。');
	}

	if (model.modelId.trim().length === 0) {
		configurationIssues.push('Model ID が未設定です。');
	}

	return {
		provider,
		model,
		configurationIssues,
		isReady: configurationIssues.length === 0 && Boolean(provider) && Boolean(model),
	};
}

export function createWorkspaceExecutionState(input: {
	setting: SettingConfig;
	prompt: string;
	status: WorkspaceExecutionStatus;
	title?: string;
	response?: string;
	messages?: WorkspaceConversationMessage[];
	streamingMessageId?: string;
	errorMessage?: string;
	canRetry?: boolean;
}): WorkspaceExecutionState {
	const { provider, model, configurationIssues } = getWorkspaceExecutionContext(input.setting);
	const prompt = input.prompt.trim();
	const status = input.status;
	const title =
		input.title ??
		(status === 'running' ? '実行中' : status === 'success' ? '実行完了' : status === 'error' ? '実行エラー' : '待機中');

	return {
		status,
		title,
		providerName: provider?.name ?? '未選択',
		modelName: model?.name ?? '未選択',
		baseUrl: provider?.baseUrl ?? '未設定',
		prompt: prompt.length > 0 ? prompt : '未入力',
		response:
			input.response ??
			(status === 'running'
				? '応答を待っています。'
				: status === 'success'
					? '応答を受信しました。'
					: status === 'error'
						? '実行に失敗しました。'
						: 'まだ実行していません。'),
		messages:
			input.messages ?? [
				{
					id: `system-${Date.now()}`,
					role: 'system',
					title: '案内',
					content: status === 'idle' ? 'プロンプトを入力して送信してください。' : '実行結果を待っています。',
					status: 'idle',
					timestamp: new Date().toISOString(),
					canRetry: false,
				},
			],
		streamingMessageId: input.streamingMessageId,
		errorMessage: input.errorMessage,
		configurationIssues,
		fileEditSafetyNotice: createWorkspaceFileEditSafetyNotice(),
		timestamp: new Date().toISOString(),
		canRetry: input.canRetry ?? status !== 'idle',
	};
}

export function createIdleWorkspaceExecutionState(setting: SettingConfig) {
	const now = new Date().toISOString();
	const hasConfigurationIssues = getConfigurationIssues(setting).length > 0;
	return createWorkspaceExecutionState({
		setting,
		prompt: '',
		status: 'idle',
		canRetry: false,
		response: hasConfigurationIssues ? '設定を確認してください。' : 'プロンプトを入力して送信してください。',
		messages: [
			{
				id: `system-${now}`,
				role: 'system',
				title: '案内',
				content: hasConfigurationIssues ? '設定を確認してください。' : 'プロンプトを入力して送信してください。',
				status: 'idle',
				timestamp: now,
				canRetry: false,
			},
		],
	});
}

export function createRunningWorkspaceExecutionState(
	setting: SettingConfig,
	prompt: string,
	messages: WorkspaceConversationMessage[] = [],
) {
	const now = new Date().toISOString();
	return createWorkspaceExecutionState({
		setting,
		prompt,
		status: 'running',
		canRetry: false,
		response: 'OpenAI 互換 Provider へ送信中です。',
		messages: [
			...messages,
			{
				id: `user-${now}`,
				role: 'user',
				title: 'あなた',
				content: prompt.trim().length > 0 ? prompt.trim() : '未入力',
				status: 'complete',
				timestamp: now,
				canRetry: false,
			},
			{
				id: `assistant-${now}`,
				role: 'assistant',
				title: '応答',
				content: '',
				status: 'streaming',
				timestamp: now,
				canRetry: false,
			},
		],
		streamingMessageId: `assistant-${now}`,
	});
}

export function createSuccessWorkspaceExecutionState(
	setting: SettingConfig,
	prompt: string,
	response: string,
	messages: WorkspaceConversationMessage[] = [],
) {
	const now = new Date().toISOString();
	return createWorkspaceExecutionState({
		setting,
		prompt,
		status: 'success',
		canRetry: true,
		response,
		messages:
			messages.length > 0
				? messages.map((message) =>
						message.role === 'assistant' && message.status === 'streaming'
							? {
									...message,
									content: response,
									status: 'complete' as const,
									timestamp: now,
									canRetry: true,
							  }
							: message,
				  )
				: [
						{
							id: `assistant-${now}`,
							role: 'assistant',
							title: '応答',
							content: response,
							status: 'complete',
							timestamp: now,
							canRetry: true,
						},
				  ],
	});
}

export function createErrorWorkspaceExecutionState(
	setting: SettingConfig,
	prompt: string,
	errorMessage: string,
	response = '実行に失敗しました。',
	messages: WorkspaceConversationMessage[] = [],
) {
	const now = new Date().toISOString();
	return createWorkspaceExecutionState({
		setting,
		prompt,
		status: 'error',
		canRetry: true,
		response,
		errorMessage,
		messages:
			messages.length > 0
				? messages.map((message) =>
						message.role === 'assistant' && message.status === 'streaming'
							? {
									...message,
									content: response,
									status: 'error' as const,
									timestamp: now,
									canRetry: true,
							  }
							: message,
				  )
				: [
						{
							id: `assistant-${now}`,
							role: 'error',
							title: 'エラー',
							content: errorMessage,
							status: 'error',
							timestamp: now,
							canRetry: true,
						},
				  ],
	});
}

export function createRunPreview(input: RunPreviewInput): RunPreviewResult {
	const provider = getSelectedProvider(input.setting);
	const model = getSelectedModel(input.setting);
	const prompt = input.prompt.trim();
	const issues = getConfigurationIssues(input.setting);
	const timestamp = new Date().toLocaleTimeString('ja-JP');

	if (!provider || !model) {
		return {
			title: '設定の確認が必要です',
			statusLabel: 'error',
			providerName: provider?.name ?? '未選択',
			modelName: model?.name ?? '未選択',
			baseUrl: provider?.baseUrl ?? '未設定',
			prompt: prompt.length > 0 ? prompt : '未入力',
			response: 'Provider / Model の設定が整うまで実行はできません。',
			checklist: issues.length > 0 ? issues : ['Provider と Model を設定してください。'],
			errorMessage: issues.join('\n'),
			timestamp,
		};
	}

	if (prompt.length === 0) {
		return {
			title: '入力待ちです',
			statusLabel: 'waiting',
			providerName: provider.name,
			modelName: model.name,
			baseUrl: provider.baseUrl,
			prompt: '未入力',
			response: '確認したいメッセージを入力すると、設定の組み合わせをプレビューできます。',
			checklist: [
				`Provider: ${provider.name}`,
				`Model: ${model.name}`,
				'メッセージを入力すると結果が更新されます',
			],
			timestamp,
		};
	}

	return {
		title: '実行プレビュー',
		statusLabel: issues.length === 0 ? 'ready' : 'error',
		providerName: provider.name,
		modelName: model.name,
		baseUrl: provider.baseUrl,
		prompt,
		response:
			issues.length === 0
				? `${provider.name} / ${model.name} に "${prompt}" を渡せる状態です。`
				: '設定の不足があるため、実行プレビューはエラー状態です。',
		checklist: [
			`Provider: ${provider.name}`,
			`Model: ${model.name}`,
			`Endpoint: ${provider.baseUrl}`,
			issues.length === 0 ? 'UI から設定情報を正しく参照しています' : `要修正: ${issues[0]}`,
		],
		errorMessage: issues.length > 0 ? issues.join('\n') : undefined,
		timestamp,
	};
}
