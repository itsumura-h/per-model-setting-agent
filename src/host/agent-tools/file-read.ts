import fs from 'node:fs/promises';
import path from 'node:path';

export type AgentToolFileReadRequest = {
	workspaceRoot: string;
	relativePath: string;
};

export type AgentToolFileReadResult = {
	absolutePath: string;
	relativePath: string;
	content: string;
};

function normalizeRelativePath(relativePath: string) {
	return relativePath.replace(/^[/\\]+/, '').trim();
}

function resolveWorkspaceFilePath(workspaceRoot: string, relativePath: string) {
	const normalizedRoot = path.resolve(workspaceRoot);
	const normalizedRelativePath = normalizeRelativePath(relativePath);
	const resolvedPath = path.resolve(normalizedRoot, normalizedRelativePath);
	const rootWithSeparator = normalizedRoot.endsWith(path.sep) ? normalizedRoot : `${normalizedRoot}${path.sep}`;

	if (resolvedPath !== normalizedRoot && !resolvedPath.startsWith(rootWithSeparator)) {
		throw new Error('workspace root の外側への読み取りは許可されていません。');
	}

	return {
		absolutePath: resolvedPath,
		relativePath: normalizedRelativePath,
	};
}

export async function agentToolFileRead(request: AgentToolFileReadRequest): Promise<AgentToolFileReadResult> {
	if (!request.workspaceRoot.trim()) {
		throw new Error('workspace root が見つかりません。');
	}

	const resolved = resolveWorkspaceFilePath(request.workspaceRoot, request.relativePath);
	const content = await fs.readFile(resolved.absolutePath, 'utf8');
	return {
		...resolved,
		content,
	};
}
