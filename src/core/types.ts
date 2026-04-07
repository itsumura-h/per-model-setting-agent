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

export type SettingsConfig = {
	version: 1;
	selectedProviderId: string;
	selectedModelId: string;
	providers: ProviderConfig[];
	models: ModelConfig[];
};

export type PersistedProviderConfig = Omit<ProviderConfig, 'apiKey'>;

export type PersistedSettingsConfig = {
	version: 1;
	selectedProviderId: string;
	selectedModelId: string;
	providers: PersistedProviderConfig[];
	models: ModelConfig[];
};

export type ConfigPreviewInput = {
	settings: SettingsConfig;
	prompt: string;
};

export type ConfigPreviewResult = {
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

export type ViewMode = 'workspace' | 'settings';

/** Extension Host と Webview で共有するブートストラップ状態 */
export type AppState = {
	viewMode: ViewMode;
	settings: SettingsConfig;
	workspaceExecution: WorkspaceExecutionState;
	workspaceFileEdit: WorkspaceFileEditState;
	filePath: string;
	loadStatus: 'fallback' | 'loaded' | 'corrupt';
	statusMessage: string;
	errorMessage?: string;
	lastSavedAt?: string;
};
