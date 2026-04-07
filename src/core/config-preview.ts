import { getConfigurationIssues, getSelectedModelStrict, getSelectedProvider } from './selectors';
import type { ConfigPreviewInput, ConfigPreviewResult } from './types';

export function createConfigPreview(input: ConfigPreviewInput): ConfigPreviewResult {
	const provider = getSelectedProvider(input.settings);
	const model = getSelectedModelStrict(input.settings);
	const prompt = input.prompt.trim();
	const issues = getConfigurationIssues(input.settings);
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
			checklist: [`Provider: ${provider.name}`, `Model: ${model.name}`, 'メッセージを入力すると結果が更新されます'],
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
