import fs from 'node:fs/promises';
import path from 'node:path';

export type AgentToolListFilesRequest = {
	workspaceRoot: string;
	pattern?: string;
	maxDepth?: number;
};

export type AgentToolListFilesResult = {
	workspaceRoot: string;
	pattern: string;
	files: string[];
	truncated: boolean;
	totalCount: number;
};

const DEFAULT_PATTERN = '**/*';
const DEFAULT_MAX_DEPTH = 5;
const DEFAULT_MAX_FILES = 500;

const EXCLUDE_DIR_NAMES = new Set([
	'.git',
	'node_modules',
	'dist',
	'.next',
	'build',
	'coverage',
	'.venv',
	'__pycache__',
	'.turbo',
	'.cache',
	'out',
	'target',
	'.pnpm-store',
]);

/** 単一セグメント内の `*` のみ（`**` はパート分割で扱う） */
function segmentMatch(segment: string, pattern: string): boolean {
	if (!pattern.includes('*')) {
		return segment === pattern;
	}

	const parts = pattern.split('*');
	let pos = 0;
	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		if (i === 0) {
			if (!segment.startsWith(part)) {
				return false;
			}
			pos = part.length;
			continue;
		}
		if (i === parts.length - 1) {
			return segment.endsWith(part);
		}
		const idx = segment.indexOf(part, pos);
		if (idx === -1) {
			return false;
		}
		pos = idx + part.length;
	}
	return true;
}

function matchGlobParts(filePathPosix: string, pattern: string): boolean {
	const pathParts = filePathPosix.split('/').filter(Boolean);
	const patParts = pattern.split('/').filter(Boolean);

	function matchParts(pi: number, si: number): boolean {
		if (pi === patParts.length) {
			return si === pathParts.length;
		}

		const pp = patParts[pi];
		if (pp === '**') {
			if (matchParts(pi + 1, si)) {
				return true;
			}
			if (si < pathParts.length && matchParts(pi, si + 1)) {
				return true;
			}
			return false;
		}

		if (si >= pathParts.length) {
			return false;
		}

		if (!segmentMatch(pathParts[si], pp)) {
			return false;
		}

		return matchParts(pi + 1, si + 1);
	}

	return matchParts(0, 0);
}

/** README / readme のようにファイル名の大小文字が揺れてもマッチさせる */
function matchGlob(filePathPosix: string, patternRaw: string): boolean {
	const pattern = (patternRaw || DEFAULT_PATTERN).replace(/\\/g, '/').trim() || DEFAULT_PATTERN;
	if (matchGlobParts(filePathPosix, pattern)) {
		return true;
	}
	return matchGlobParts(filePathPosix.toLowerCase(), pattern.toLowerCase());
}

function resolveWorkspaceSubdir(workspaceRoot: string): string {
	const normalized = path.resolve(workspaceRoot);
	if (!normalized) {
		throw new Error('workspace root が無効です。');
	}
	return normalized;
}

/**
 * workspace 配下を走査し、glob に一致するファイルの相対パス一覧を返す。
 */
export async function agentToolListFiles(request: AgentToolListFilesRequest): Promise<AgentToolListFilesResult> {
	const root = resolveWorkspaceSubdir(request.workspaceRoot);
	const pattern = request.pattern?.trim() || DEFAULT_PATTERN;
	const maxDepth = typeof request.maxDepth === 'number' && Number.isFinite(request.maxDepth) && request.maxDepth >= 0
		? Math.floor(request.maxDepth)
		: DEFAULT_MAX_DEPTH;

	const matched: string[] = [];
	let truncated = false;

	async function walkDir(absDir: string, dirDepth: number): Promise<void> {
		if (matched.length >= DEFAULT_MAX_FILES) {
			truncated = true;
			return;
		}

		if (dirDepth > maxDepth) {
			return;
		}

		let entries;
		try {
			entries = await fs.readdir(absDir, { withFileTypes: true });
		} catch {
			return;
		}

		for (const ent of entries) {
			if (matched.length >= DEFAULT_MAX_FILES) {
				truncated = true;
				return;
			}

			if (ent.isSymbolicLink()) {
				continue;
			}

			const absChild = path.join(absDir, ent.name);
			const rel = path.relative(root, absChild);
			const relPosix = rel.replace(/\\/g, '/');

			if (ent.isDirectory()) {
				if (EXCLUDE_DIR_NAMES.has(ent.name)) {
					continue;
				}
				await walkDir(absChild, dirDepth + 1);
				if (truncated && matched.length >= DEFAULT_MAX_FILES) {
					return;
				}
				continue;
			}

			if (ent.isFile() && matchGlob(relPosix, pattern)) {
				matched.push(relPosix);
				if (matched.length >= DEFAULT_MAX_FILES) {
					truncated = true;
					return;
				}
			}
		}
	}

	await walkDir(root, 0);

	matched.sort();

	return {
		workspaceRoot: root,
		pattern,
		files: matched,
		truncated,
		totalCount: matched.length,
	};
}
