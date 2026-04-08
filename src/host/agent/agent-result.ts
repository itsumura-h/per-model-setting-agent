import { fileEditTool } from './tools/file-edit-tool';
import { fileReadTool } from './tools/file-read-tool';
import type { AgentFileEdit, AgentFileRead, AgentResult } from './types';

export function getFileEditOutputs(result: AgentResult): AgentFileEdit[] {
	const v = result.toolOutputs[fileEditTool.id];
	return Array.isArray(v) ? (v as AgentFileEdit[]) : [];
}

export function getFileReadOutputs(result: AgentResult): AgentFileRead[] {
	const v = result.toolOutputs[fileReadTool.id];
	return Array.isArray(v) ? (v as AgentFileRead[]) : [];
}

export function withToolOutput<T>(result: AgentResult, toolId: string, items: T[]): AgentResult {
	return {
		...result,
		toolOutputs: {
			...result.toolOutputs,
			[toolId]: items,
		},
	};
}
