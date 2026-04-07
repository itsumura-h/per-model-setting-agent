import * as vscode from 'vscode';

import type { SettingsConfig } from '../core/index';

const SECRET_PREFIX = 'permosa.provider.apiKey.';

export function getProviderSecretKey(providerId: string) {
	return `${SECRET_PREFIX}${providerId}`;
}

export async function readProviderApiKeys(context: vscode.ExtensionContext, providers: SettingsConfig['providers']) {
	const entries = await Promise.all(
		providers.map(async (provider) => {
			const key = await context.secrets.get(getProviderSecretKey(provider.id));
			return [provider.id, key ?? ''] as const;
		}),
	);

	return Object.fromEntries(entries);
}

export async function persistProviderApiKeys(
	context: vscode.ExtensionContext,
	previousProviders: SettingsConfig['providers'],
	nextProviders: SettingsConfig['providers'],
) {
	const previousIds = new Set(previousProviders.map((provider) => provider.id));
	const nextIds = new Set(nextProviders.map((provider) => provider.id));

	for (const provider of previousProviders) {
		if (!nextIds.has(provider.id)) {
			await context.secrets.delete(getProviderSecretKey(provider.id));
		}
	}

	for (const provider of nextProviders) {
		const secretKey = getProviderSecretKey(provider.id);
		const apiKey = provider.apiKey?.trim() ?? '';

		if (apiKey.length > 0) {
			await context.secrets.store(secretKey, apiKey);
			continue;
		}

		if (previousIds.has(provider.id)) {
			await context.secrets.delete(secretKey);
		}
	}
}
