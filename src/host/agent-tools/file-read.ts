import fs from 'node:fs/promises';
import path from 'node:path';

export type AgentToolFileReadRequest = {
	workspaceRoot: string;
	/** 相対パスまたは workspace 内の絶対パス */
	filePath: string;
};

export type AgentToolFileReadResult = {
	absolutePath: string;
	relativePath: string;
	content: string;
};

function normalizeRelativePath(relativePath: string) {
	return relativePath.replace(/^[/\\]+/, '').trim();
}

export function resolveWorkspaceFilePathForRead(workspaceRoot: string, inputPath: string): { absolutePath: string; relativePath: string } {
	const normalizedRoot = path.resolve(workspaceRoot);
	const rootWithSeparator = normalizedRoot.endsWith(path.sep) ? normalizedRoot : `${normalizedRoot}${path.sep}`;
	const trimmed = inputPath.trim();

	if (!trimmed) {
		throw new Error('ファイルパスが空です。');
	}

	if (path.isAbsolute(trimmed)) {
		const resolved = path.resolve(trimmed);
		const rel = path.relative(normalizedRoot, resolved);
		if (rel.startsWith('..') || path.isAbsolute(rel)) {
			throw new Error('workspace root の外側への読み取りは許可されていません。');
		}

		return {
			absolutePath: resolved,
			relativePath: rel.replace(/\\/g, '/'),
		};
	}

	const normalizedRelative = normalizeRelativePath(trimmed);
	const resolvedPath = path.resolve(normalizedRoot, normalizedRelative);

	if (resolvedPath !== normalizedRoot && !resolvedPath.startsWith(rootWithSeparator)) {
		throw new Error('workspace root の外側への読み取りは許可されていません。');
	}

	return {
		absolutePath: resolvedPath,
		relativePath: normalizedRelative.replace(/\\/g, '/'),
	};
}

export async function agentToolFileRead(request: AgentToolFileReadRequest): Promise<AgentToolFileReadResult> {
	if (!request.workspaceRoot.trim()) {
		throw new Error('workspace root が見つかりません。');
	}

	const rawPath = request.filePath.trim();
	if (!rawPath) {
		throw new Error('ファイルパスが指定されていません。');
	}

	const resolved = resolveWorkspaceFilePathForRead(request.workspaceRoot, rawPath);
	const content = await fs.readFile(resolved.absolutePath, 'utf8');
	return {
		...resolved,
		content,
	};
}
