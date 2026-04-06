export type DemoProviderId = 'cometapi' | 'openrouter';

export type DemoProvider = {
	id: DemoProviderId;
	name: string;
	baseUrl: string;
	defaultModelId: string;
	description: string;
};

export type DemoModel = {
	id: string;
	name: string;
	providerId: DemoProviderId;
};

export type DemoRunInput = {
	providerId: DemoProviderId;
	modelId: string;
	prompt: string;
};

export type DemoRunResult = {
	title: string;
	statusLabel: string;
	providerName: string;
	modelName: string;
	baseUrl: string;
	prompt: string;
	response: string;
	checklist: string[];
	timestamp: string;
};

export const demoProviders: DemoProvider[] = [
	{
		id: 'cometapi',
		name: 'CometAPI',
		baseUrl: 'https://api.cometapi.com/v1',
		defaultModelId: 'deepseek-chat',
		description: 'OpenAI互換の基本確認用プロバイダー',
	},
	{
		id: 'openrouter',
		name: 'OpenRouter',
		baseUrl: 'https://openrouter.ai/api/v1',
		defaultModelId: 'openai/gpt-4.1-mini',
		description: '追加ヘッダー確認も想定したプロバイダー',
	},
];

const demoModels: DemoModel[] = [
	{
		id: 'deepseek-chat',
		name: 'DeepSeek Chat',
		providerId: 'cometapi',
	},
	{
		id: 'deepseek-reasoner',
		name: 'DeepSeek Reasoner',
		providerId: 'cometapi',
	},
	{
		id: 'openai/gpt-4.1-mini',
		name: 'GPT-4.1 Mini',
		providerId: 'openrouter',
	},
	{
		id: 'anthropic/claude-3.5-sonnet',
		name: 'Claude 3.5 Sonnet',
		providerId: 'openrouter',
	},
];

export function getDemoModels(providerId: DemoProviderId): DemoModel[] {
	return demoModels.filter((model) => model.providerId === providerId);
}

export function getDemoSelection(providerId: DemoProviderId) {
	const provider = demoProviders.find((entry) => entry.id === providerId) ?? demoProviders[0];
	const models = getDemoModels(provider.id);
	const model = models.find((entry) => entry.id === provider.defaultModelId) ?? models[0];

	return {
		provider,
		model,
	};
}

export function createDemoRun(input: DemoRunInput): DemoRunResult {
	const selection = getDemoSelection(input.providerId);
	const model = getDemoModels(selection.provider.id).find((entry) => entry.id === input.modelId) ?? selection.model;
	const prompt = input.prompt.trim();
	const hasPrompt = prompt.length > 0;
	const providerName = selection.provider.name;
	const modelName = model?.name ?? selection.model.name;

	return {
		title: 'Core 動作確認',
		statusLabel: hasPrompt ? 'ready' : 'waiting',
		providerName,
		modelName,
		baseUrl: selection.provider.baseUrl,
		prompt: hasPrompt ? prompt : '動作確認メッセージが未入力です。',
		response: hasPrompt
			? `${providerName} / ${modelName} に "${prompt}" を渡せる状態です。`
			: 'メッセージを入力してから「実行」を押すと、core の返り値が変わります。',
		checklist: [
			`Provider: ${providerName}`,
			`Model: ${modelName}`,
			hasPrompt ? 'UI から core へ入力が届いています' : '入力すると結果が更新されます',
			`Endpoint: ${selection.provider.baseUrl}`,
		],
		timestamp: new Date().toLocaleTimeString('ja-JP'),
	};
}
