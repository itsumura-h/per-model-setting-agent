import { getFileEditOutputs, withToolOutput } from './agent-result';
import type { AgentResult } from './types';
import { fileEditTool } from './tools';

export function ensureFileEdits(result: AgentResult, prompt: string): AgentResult {
	if (getFileEditOutputs(result).length > 0 || !fileEditTool.matchesRequest(prompt)) {
		return result;
	}

	const inferredFileEdits = inferAgentFileEdits(prompt);
	if (inferredFileEdits.length === 0) {
		return result;
	}

	return withToolOutput(result, fileEditTool.id, inferredFileEdits);
}

function inferAgentFileEdits(prompt: string): Array<{ relativePath: string; content: string }> {
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
