import fs from 'node:fs/promises';
import path from 'node:path';

export type AgentToolFileEditRequest = {
	workspaceRoot: string;
	relativePath: string;
	content: string;
};

export type AgentToolFileEditResult = {
	absolutePath: string;
	relativePath: string;
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
		throw new Error('workspace root の外側への書き込みは許可されていません。');
	}

	return {
		absolutePath: resolvedPath,
		relativePath: normalizedRelativePath,
	};
}

export async function agentToolFileEditWrite(request: AgentToolFileEditRequest): Promise<AgentToolFileEditResult> {
	if (!request.workspaceRoot.trim()) {
		throw new Error('workspace root が見つかりません。');
	}

	const resolved = resolveWorkspaceFilePath(request.workspaceRoot, request.relativePath);
	await fs.mkdir(path.dirname(resolved.absolutePath), { recursive: true });
	await fs.writeFile(resolved.absolutePath, request.content, 'utf8');

	return resolved;
}
