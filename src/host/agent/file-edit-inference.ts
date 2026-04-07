import { isFileEditRequest } from './prompt-builder';
import type { AgentFileEdit, AgentResult } from './types';

export function ensureFileEdits(result: AgentResult, prompt: string): AgentResult {
	if (result.fileEdits.length > 0 || !isFileEditRequest(prompt)) {
		return result;
	}

	const inferredFileEdits = inferAgentFileEdits(prompt);
	if (inferredFileEdits.length === 0) {
		return result;
	}

	return {
		...result,
		fileEdits: inferredFileEdits,
	};
}

function inferAgentFileEdits(prompt: string): AgentFileEdit[] {
	const normalizedPrompt = prompt.trim();
	if (!normalizedPrompt) {
		return [];
	}

	const pathCandidates = [...normalizedPrompt.matchAll(/[A-Za-z0-9._/-]+\.[A-Za-z0-9._-]+/g)]
		.map((match) => match[0])
		.map((candidate) => candidate.replace(/^[/\\]+/, '').replace(/[.。．、,!?]+$/g, '').trim())
		.filter((candidate) => candidate.length > 0);

	const uniqueCandidates = [...new Set(pathCandidates)];
	if (uniqueCandidates.length === 0) {
		return [];
	}

	return uniqueCandidates.slice(0, 3).map((relativePath) => ({
		relativePath,
		content: '',
	}));
}
