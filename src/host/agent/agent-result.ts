import { fileEditTool } from './tools/file-edit-tool';
import { fileReadTool } from './tools/file-read-tool';
import { listFilesTool } from './tools/list-files-tool';
import { shellExecTool } from './tools/shell-exec-tool';
import type { AgentFileEdit, AgentFileRead, AgentListFiles, AgentResult, AgentShellExec } from './types';

export function getFileEditOutputs(result: AgentResult): AgentFileEdit[] {
	const v = result.toolOutputs[fileEditTool.id];
	return Array.isArray(v) ? (v as AgentFileEdit[]) : [];
}

export function getFileReadOutputs(result: AgentResult): AgentFileRead[] {
	const v = result.toolOutputs[fileReadTool.id];
	return Array.isArray(v) ? (v as AgentFileRead[]) : [];
}

export function getListFilesOutputs(result: AgentResult): AgentListFiles[] {
	const v = result.toolOutputs[listFilesTool.id];
	return Array.isArray(v) ? (v as AgentListFiles[]) : [];
}

export function getShellExecOutputs(result: AgentResult): AgentShellExec[] {
	const v = result.toolOutputs[shellExecTool.id];
	return Array.isArray(v) ? (v as AgentShellExec[]) : [];
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

/** いずれかのツールに非空の出力があるか（最終回答のみのときは false） */
export function hasAnyToolOutputs(result: AgentResult): boolean {
	for (const value of Object.values(result.toolOutputs)) {
		if (Array.isArray(value) && value.length > 0) {
			return true;
		}
	}
	return false;
}
