import type { ModelConfig, ProviderPreset } from './types';

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
