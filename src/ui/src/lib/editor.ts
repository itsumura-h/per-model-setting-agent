import {
	modelPresets,
	providerPresets,
	type ModelConfig,
	type ProviderConfig,
	type ProviderPresetId,
} from '../../../core/index';
import type { EditorState } from '../types';

function createId(prefix: string) {
	const suffix = globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
	return `${prefix}-${suffix}`;
}

export function formatHeadersText(headers: Record<string, string>) {
	return JSON.stringify(headers, null, 2);
}

export function parseHeadersText(text: string) {
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

export function createProviderDraft(presetId: ProviderPresetId | 'custom' = 'cometapi'): ProviderConfig {
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

export function createModelDraft(providerId: string, providers: ProviderConfig[]): ModelConfig {
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

export function createProviderDraftFromCurrent(provider: ProviderConfig) {
	return {
		...provider,
		apiKey: provider.apiKey ?? '',
		headers: { ...provider.headers },
	};
}

export function createModelDraftFromCurrent(model: ModelConfig) {
	return { ...model };
}

export function getProviderPreset(provider: ProviderConfig) {
	if (provider.presetId === 'cometapi' || provider.presetId === 'openrouter') {
		return providerPresets.find((entry) => entry.id === provider.presetId);
	}

	return undefined;
}

export function makeProviderEditorDraft(provider?: ProviderConfig): EditorState {
	const draft = provider ? createProviderDraftFromCurrent(provider) : createProviderDraft();

	return {
		kind: 'provider',
		mode: provider ? 'edit' : 'create',
		draft,
		headersText: formatHeadersText(draft.headers),
	};
}

export function makeModelEditorDraft(model: ModelConfig | undefined, providerId: string, providers: ProviderConfig[]): EditorState {
	const draft = model ? createModelDraftFromCurrent(model) : createModelDraft(providerId, providers);

	return {
		kind: 'model',
		mode: model ? 'edit' : 'create',
		draft,
	};
}
