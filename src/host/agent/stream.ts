import OpenAI, { APIError } from 'openai';

import { parseAgentResult, extractChatCompletionText } from './response-parser';
import { agentTools } from './tools';
import type { AgentResult, AgentStreamEvent, AgentStreamObserver } from './types';

export async function emitStreamEvent(observer: AgentStreamObserver | undefined, event: AgentStreamEvent) {
	await observer?.onEvent?.(event);

	if (event.type === 'start') {
		await observer?.onStart?.(event);
	}

	if (event.type === 'delta') {
		await observer?.onDelta?.(event);
	}

	if (event.type === 'complete') {
		await observer?.onComplete?.(event);
	}

	if (event.type === 'error') {
		await observer?.onError?.(event);
	}
}

export function shouldFallbackToChatCompletions(error: unknown) {
	if (!(error instanceof APIError)) {
		return false;
	}

	return [400, 404, 405, 410, 415, 422, 501].includes(error.status ?? 0);
}

export async function requestAgentResponsesStream({
	client,
	modelId,
	prompt,
	systemPrompt,
	requestId,
	observer,
}: {
	client: OpenAI;
	modelId: string;
	prompt: string;
	systemPrompt: string;
	requestId: string;
	observer?: AgentStreamObserver;
}): Promise<AgentResult> {
	const stream = await client.responses.create({
		model: modelId,
		instructions: systemPrompt,
		input: prompt,
		stream: true,
	});

	let accumulatedText = '';
	let sequenceNumber = 0;

	for await (const event of stream as AsyncIterable<Record<string, unknown>>) {
		if (event.type === 'response.output_text.delta') {
			const delta = typeof event.delta === 'string' ? event.delta : '';
			if (delta.length === 0) {
				continue;
			}

			accumulatedText += delta;
			sequenceNumber += 1;

			await emitStreamEvent(observer, {
				type: 'delta',
				delta,
				accumulatedText,
				sequenceNumber,
				timestamp: new Date().toISOString(),
			});
			continue;
		}

		if (event.type === 'response.output_text.done') {
			const text = typeof event.text === 'string' ? event.text : '';
			if (text.length > accumulatedText.length) {
				accumulatedText = text;
			}
			continue;
		}

		if (event.type === 'response.completed') {
			return finalizeAgentStream({
				text: accumulatedText,
				requestId,
				observer,
			});
		}

		if (event.type === 'error') {
			const errorMessage =
				(typeof event.error === 'string' && event.error.trim().length > 0
					? event.error
					: typeof event.message === 'string' && event.message.trim().length > 0
						? event.message
						: 'Responses API stream error');
			throw new Error(errorMessage);
		}
	}

	return finalizeAgentStream({
		text: accumulatedText,
		requestId,
		observer,
	});
}

export async function requestAgentChatCompletionStream({
	client,
	modelId,
	prompt,
	systemPrompt,
	requestId,
	observer,
}: {
	client: OpenAI;
	modelId: string;
	prompt: string;
	systemPrompt: string;
	requestId: string;
	observer?: AgentStreamObserver;
}): Promise<AgentResult> {
	const completion = await client.chat.completions.create({
		model: modelId,
		stream: true,
		messages: [
			{
				role: 'system',
				content: systemPrompt,
			},
			{ role: 'user', content: prompt },
		],
	});

	let accumulatedText = '';
	let sequenceNumber = 0;

	for await (const chunk of completion as AsyncIterable<Record<string, unknown>>) {
		const chunkRecord = chunk as { choices?: unknown };
		const choices = Array.isArray(chunkRecord.choices) ? chunkRecord.choices : [];
		const choice = choices[0] as { delta?: { content?: unknown } } | undefined;
		const delta = choice && typeof choice === 'object' ? (choice as { delta?: { content?: unknown } }).delta?.content : undefined;

		if (typeof delta === 'string' && delta.length > 0) {
			accumulatedText += delta;
			sequenceNumber += 1;

			await emitStreamEvent(observer, {
				type: 'delta',
				delta,
				accumulatedText,
				sequenceNumber,
				timestamp: new Date().toISOString(),
			});
		}
	}

	return finalizeAgentStream({
		text: accumulatedText,
		requestId,
		observer,
	});
}

export async function requestAgentCompletion({
	client,
	modelId,
	prompt,
	systemPrompt,
}: {
	client: OpenAI;
	modelId: string;
	prompt: string;
	systemPrompt: string;
}): Promise<AgentResult> {
	const completion = await client.chat.completions.create({
		model: modelId,
		messages: [
			{
				role: 'system',
				content: systemPrompt,
			},
			{ role: 'user', content: prompt },
		],
	});

	return parseAgentResult(extractChatCompletionText(completion), agentTools);
}

async function finalizeAgentStream({
	text,
	requestId,
	observer,
}: {
	text: string;
	requestId: string;
	observer?: AgentStreamObserver;
}): Promise<AgentResult> {
	const parsedResult = parseAgentResult(text, agentTools);
	const completeEvent: Extract<AgentStreamEvent, { type: 'complete' }> = {
		type: 'complete',
		text: parsedResult.assistantMessage,
		toolOutputs: parsedResult.toolOutputs,
		rawResponse: parsedResult.rawResponse,
		requestId,
		timestamp: new Date().toISOString(),
	};

	await emitStreamEvent(observer, completeEvent);
	return parsedResult;
}
