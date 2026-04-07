import type { ProviderPresetId } from './types';
import { providerPresets } from './presets';

export function createId(prefix: string) {
	const suffix =
		globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
	return `${prefix}-${suffix}`;
}

export function isProviderPresetId(value: string | undefined): value is Exclude<ProviderPresetId, 'custom'> {
	return value === 'cometapi' || value === 'openrouter';
}

export function getPresetById(id: Exclude<ProviderPresetId, 'custom'>) {
	return providerPresets.find((entry) => entry.id === id);
}
