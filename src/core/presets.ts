import type { ModelConfig, ProviderPreset } from './types';

export const providerPresets: ProviderPreset[] = [
	{
		id: 'cometapi',
		name: 'CometAPI',
		baseUrl: 'https://api.cometapi.com/v1',
		defaultModelId: 'deepseek-chat',
		defaultHeaders: {},
	},
	{
		id: 'openrouter',
		name: 'OpenRouter',
		baseUrl: 'https://openrouter.ai/api/v1',
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
		modelId: 'deepseek-chat',
	},
	{
		id: 'deepseek-reasoner',
		name: 'DeepSeek Reasoner',
		providerId: 'cometapi',
		enabled: true,
		modelId: 'deepseek-reasoner',
	},
	{
		id: 'openai-gpt-4.1-mini',
		name: 'GPT-4.1 Mini',
		providerId: 'openrouter',
		enabled: true,
		modelId: 'openai/gpt-4.1-mini',
	},
	{
		id: 'anthropic-claude-3.5-sonnet',
		name: 'Claude 3.5 Sonnet',
		providerId: 'openrouter',
		enabled: true,
		modelId: 'anthropic/claude-3.5-sonnet',
	},
];
