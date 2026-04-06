import OpenAI, { APIError, type ChatCompletion } from 'openai';

import type { ProviderConfig, SettingConfig } from './core/index';
import { getWorkspaceExecutionContext } from './core/index';

function pickHeaders(headers: Record<string, string>) {
	return Object.fromEntries(
		Object.entries(headers).filter(([, value]) => typeof value === 'string' && value.trim().length > 0),
	);
}

export function createWorkspaceOpenAIClient(provider: ProviderConfig) {
	return new OpenAI({
		baseURL: provider.baseUrl,
		apiKey: provider.apiKey ?? '',
		defaultHeaders: pickHeaders(provider.headers),
	});
}

export async function executeWorkspacePrompt(setting: SettingConfig, prompt: string) {
	const { provider, model, configurationIssues, isReady } = getWorkspaceExecutionContext(setting);
	if (!isReady || !provider || !model) {
		throw new Error(configurationIssues.join('\n') || 'Provider / Model の設定が不足しています。');
	}

	const client = createWorkspaceOpenAIClient(provider);
	const completion = await client.chat.completions.create({
		model: model.modelId,
		messages: [
			{
				role: 'system',
				content:
					'You are a VS Code workspace agent. Answer in Japanese unless the user asks for another language. Be concise, practical, and explicit about assumptions.',
			},
			{ role: 'user', content: prompt.trim() },
		],
	});

	return extractChatCompletionText(completion);
}

export function formatWorkspaceAgentError(error: unknown) {
	if (error instanceof APIError) {
		const details = [
			`OpenAI API error (${error.status})`,
			error.name,
			error.message,
			error.request_id ? `request_id: ${error.request_id}` : '',
		].filter((value) => value.trim().length > 0);

		return details.join('\n');
	}

	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}

function extractChatCompletionText(completion: ChatCompletion) {
	const content = completion.choices[0]?.message?.content;
	if (typeof content === 'string') {
		return content;
	}

	if (Array.isArray(content)) {
		return content
			.map((part) => {
				if (typeof part === 'string') {
					return part;
				}

				if (part && typeof part === 'object' && 'text' in part && typeof part.text === 'string') {
					return part.text;
				}

				return '';
			})
			.join('');
	}

	return '';
}
