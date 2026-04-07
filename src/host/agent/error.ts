import { APIError } from 'openai';

export function formatAgentError(error: unknown) {
	if (error instanceof APIError) {
		const details = [
			`OpenAI API error (${error.status})`,
			error.name,
			error.message,
			error.requestID ? `request_id: ${error.requestID}` : '',
		].filter((value) => value.trim().length > 0);

		return details.join('\n');
	}

	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}
