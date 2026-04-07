import OpenAI from 'openai';

import type { ProviderConfig } from '../../core/index';

function pickHeaders(headers: Record<string, string>) {
	return Object.fromEntries(
		Object.entries(headers).filter(([, value]) => typeof value === 'string' && value.trim().length > 0),
	);
}

export function createOpenAIClient(provider: ProviderConfig) {
	return new OpenAI({
		baseURL: provider.baseUrl,
		apiKey: provider.apiKey ?? '',
		defaultHeaders: pickHeaders(provider.headers),
	});
}

export async function initializeOpenAIAgentsRuntime(provider: ProviderConfig) {
	const loader = new Function('return import("@openai/agents")') as () => Promise<
		Partial<{
			setDefaultOpenAIClient: (client: OpenAI) => void;
			setOpenAIAPI: (api: 'responses' | 'chat_completions') => void;
		}>
	>;

	try {
		const agents = await loader();
		agents.setDefaultOpenAIClient?.(createOpenAIClient(provider));
		agents.setOpenAIAPI?.('responses');
		return true;
	} catch {
		return false;
	}
}
