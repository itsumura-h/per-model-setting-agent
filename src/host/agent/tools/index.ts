import { fileEditTool } from './file-edit-tool';
import { fileReadTool } from './file-read-tool';
import { listFilesTool } from './list-files-tool';
import { shellExecTool } from './shell-exec-tool';

/** 推奨フロー: listFiles → shellExec → fileReads → fileEdits に近い説明順 */
export const agentTools = [listFilesTool, shellExecTool, fileReadTool, fileEditTool] as const;

export { fileEditTool };

export function getActiveToolIds(prompt: string): string[] {
	return agentTools.filter((tool) => tool.matchesRequest(prompt)).map((tool) => tool.id);
}
