import { fileEditTool } from './file-edit-tool';
import { fileReadTool } from './file-read-tool';

export const agentTools = [fileEditTool, fileReadTool] as const;

export { fileEditTool, fileReadTool };
export type { ToolDefinition } from './types';

export function getActiveToolIds(prompt: string): string[] {
	return agentTools.filter((tool) => tool.matchesRequest(prompt)).map((tool) => tool.id);
}
