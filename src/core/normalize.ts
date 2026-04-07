import { modelPresets, providerPresets } from './presets';
import type {
	ModelConfig,
	PersistedSettingsConfig,
	ProviderConfig,
	ProviderPreset,
	SettingsConfig,
} from './types';
import { createId, getPresetById, isProviderPresetId } from './utils';

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
	const name =
		typeof input.name === 'string' && input.name.trim().length > 0 ? input.name.trim() : preset?.name ?? '未設定のプロバイダー';
	const baseUrl =
		typeof input.baseUrl === 'string' && input.baseUrl.trim().length > 0 ? input.baseUrl.trim() : preset?.baseUrl ?? '';
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
	const providerId =
		typeof input.providerId === 'string' && providers.some((entry) => entry.id === input.providerId)
			? input.providerId
			: providers[0]?.id ?? '';
	const providerPreset = providers.find((entry) => entry.id === providerId)?.presetId;
	const preset =
		providerPreset && isProviderPresetId(providerPreset)
			? providerPresets.find((entry) => entry.id === providerPreset)
			: undefined;
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

export function createDefaultSettingsConfig(): SettingsConfig {
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

export function normalizeSettingsConfig(
	input?: Partial<PersistedSettingsConfig> | Partial<SettingsConfig> | null,
): SettingsConfig {
	const defaults = createDefaultSettingsConfig();
	const providersSource = Array.isArray(input?.providers) ? input.providers : undefined;
	const providers =
		providersSource === undefined
			? defaults.providers
			: providersSource
					.map((entry) => normalizeProvider(entry))
					.filter((entry) => entry.name.length > 0 && entry.baseUrl.length > 0);

	const modelsSource = Array.isArray(input?.models) ? input.models : undefined;
	const rawModels =
		modelsSource === undefined ? (providersSource === undefined ? defaults.models : []) : modelsSource;
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

export function hydrateSettingsConfig(
	input?: Partial<PersistedSettingsConfig> | Partial<SettingsConfig> | null,
	apiKeysByProviderId: Record<string, string> = {},
) {
	const normalized = normalizeSettingsConfig(input);

	return {
		...normalized,
		providers: normalized.providers.map((provider) => ({
			...provider,
			apiKey: apiKeysByProviderId[provider.id] ?? provider.apiKey ?? '',
		})),
	};
}

export function serializeSettingsConfig(settings: SettingsConfig): PersistedSettingsConfig {
	return {
		version: 1,
		selectedProviderId: settings.selectedProviderId,
		selectedModelId: settings.selectedModelId,
		providers: settings.providers.map(({ apiKey: _apiKey, ...provider }) => provider),
		models: settings.models.map((model) => ({ ...model })),
	};
}
