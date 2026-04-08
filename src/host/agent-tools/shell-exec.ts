import { spawn } from 'node:child_process';
import path from 'node:path';

export type AgentToolShellExecRequest = {
	workspaceRoot: string;
	command: string;
	cwd?: string;
	timeoutMs?: number;
};

export type AgentToolShellExecResult = {
	command: string;
	cwd: string;
	stdout: string;
	stderr: string;
	exitCode: number | null;
	timedOut: boolean;
	truncated: boolean;
};

const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_CHUNK = 100_000;

const BLOCK_PATTERNS: RegExp[] = [
	/\brm\s+(-[rf]*\s+)*\/\s*$/i,
	/\brm\s+(-[rf]+\s+)+\//i,
	/\bsudo\b/i,
	/\bsu\s+-/i,
	/\bshutdown\b/i,
	/\breboot\b/i,
	/\bmkfs\b/i,
	/\bdd\s+if=/i,
	/\bcurl\s+[^|]*\|\s*(?:ba)?sh\b/i,
	/\bwget\s+[^|]*\|\s*(?:ba)?sh\b/i,
	/>\s*\/dev\/sd[a-z]/i,
	/:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;/,
];

function isCommandBlocked(command: string): boolean {
	const trimmed = command.trim();
	if (trimmed.length === 0) {
		return true;
	}
	return BLOCK_PATTERNS.some((re) => re.test(trimmed));
}

function resolveShellCwd(workspaceRoot: string, cwdRelative?: string): string {
	const root = path.resolve(workspaceRoot);
	const rootSep = root.endsWith(path.sep) ? root : `${root}${path.sep}`;

	if (!cwdRelative || !cwdRelative.trim()) {
		return root;
	}

	const normalized = cwdRelative.replace(/^[/\\]+/, '').trim();
	const resolved = path.resolve(root, normalized);
	if (resolved !== root && !resolved.startsWith(rootSep)) {
		throw new Error('cwd は workspace root 配下の相対パスにしてください。');
	}

	return resolved;
}

function truncateOutput(text: string): { text: string; truncated: boolean } {
	if (text.length <= MAX_CHUNK) {
		return { text, truncated: false };
	}
	return { text: text.slice(0, MAX_CHUNK), truncated: true };
}

function minimalEnv(): NodeJS.ProcessEnv {
	return {
		PATH: process.env.PATH ?? '',
		HOME: process.env.HOME ?? '',
		USER: process.env.USER ?? '',
		SystemRoot: process.env.SystemRoot,
		PATHEXT: process.env.PATHEXT,
		COMSPEC: process.env.COMSPEC,
	};
}

export async function agentToolShellExec(request: AgentToolShellExecRequest): Promise<AgentToolShellExecResult> {
	const workspaceRoot = request.workspaceRoot.trim();
	if (!workspaceRoot) {
		throw new Error('workspace root が見つかりません。');
	}

	const command = request.command.trim();
	if (isCommandBlocked(command)) {
		throw new Error('このコマンドは安全のため実行できません。');
	}

	const cwd = resolveShellCwd(workspaceRoot, request.cwd);
	const timeoutMs =
		typeof request.timeoutMs === 'number' && Number.isFinite(request.timeoutMs) && request.timeoutMs > 0
			? Math.floor(request.timeoutMs)
			: DEFAULT_TIMEOUT_MS;

	const isWindows = process.platform === 'win32';
	const shellCmd = isWindows ? process.env.ComSpec || 'cmd.exe' : '/bin/sh';
	const shellArgs = isWindows ? ['/d', '/s', '/c', command] : ['-c', command];

	return await new Promise((resolve, reject) => {
		const child = spawn(shellCmd, shellArgs, {
			cwd,
			env: minimalEnv(),
			windowsHide: true,
		});

		let stdout = '';
		let stderr = '';
		let timedOut = false;
		let finished = false;

		const timer = setTimeout(() => {
			if (finished) {
				return;
			}
			timedOut = true;
			child.kill('SIGTERM');
			setTimeout(() => {
				if (!finished) {
					child.kill('SIGKILL');
				}
			}, 500);
		}, timeoutMs);

		child.stdout?.on('data', (chunk: Buffer) => {
			stdout += chunk.toString('utf8');
		});
		child.stderr?.on('data', (chunk: Buffer) => {
			stderr += chunk.toString('utf8');
		});

		child.on('error', (err) => {
			clearTimeout(timer);
			if (!finished) {
				finished = true;
				reject(err);
			}
		});

		child.on('close', (code) => {
			if (finished) {
				return;
			}
			finished = true;
			clearTimeout(timer);

			const out = truncateOutput(stdout);
			const err = truncateOutput(stderr);
			const truncated = out.truncated || err.truncated;

			resolve({
				command,
				cwd,
				stdout: out.text,
				stderr: err.text,
				exitCode: timedOut ? null : code,
				timedOut,
				truncated,
			});
		});
	});
}
