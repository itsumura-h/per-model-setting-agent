import { providerPresets } from './presets';
import type { SettingsConfig } from './types';

export function resolveSelectionAfterMutation({
	nextProviders,
	nextModels,
	previousProviderId,
	previousModelId,
}: {
	nextProviders: SettingsConfig['providers'];
	nextModels: SettingsConfig['models'];
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

export function getProviderPresetByProviderId(providerId: string) {
	return providerPresets.find((entry) => entry.id === providerId);
}

export function getProviderModels(settings: SettingsConfig, providerId: string) {
	return settings.models.filter((model) => model.providerId === providerId);
}

export function getSelectedProvider(settings: SettingsConfig) {
	return settings.providers.find((provider) => provider.id === settings.selectedProviderId);
}

/** Provider と Model の両方の選択 ID が一致するモデルのみ返す（UI の厳密な「選択中」表示用） */
export function getSelectedModelStrict(settings: SettingsConfig) {
	return settings.models.find(
		(model) => model.id === settings.selectedModelId && model.providerId === settings.selectedProviderId,
	);
}

/** selectedModelId のみでモデルを返す（実行コンテキストの標準解決） */
export function getSelectedModel(settings: SettingsConfig) {
	return settings.models.find((model) => model.id === settings.selectedModelId);
}

export function getSelectedProviderByModel(settings: SettingsConfig) {
	const model = getSelectedModel(settings);
	if (model) {
		return settings.providers.find((provider) => provider.id === model.providerId);
	}

	return getSelectedProvider(settings);
}

export function getConfigurationIssues(settings: SettingsConfig) {
	const issues: string[] = [];
	const selectedProvider = getSelectedProvider(settings);
	const selectedModel = getSelectedModelStrict(settings);

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

export function getWorkspaceExecutionContext(settings: SettingsConfig) {
	const model = getSelectedModel(settings);
	const provider = getSelectedProviderByModel(settings);
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
