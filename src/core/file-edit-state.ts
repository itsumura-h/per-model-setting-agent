import type { WorkspaceFileEditSafetyNotice, WorkspaceFileEditState } from './types';

export function createWorkspaceFileEditSafetyNotice(): WorkspaceFileEditSafetyNotice {
	return {
		title: 'ファイル編集前の安全確認',
		items: [
			'対象ファイルを先に明示し、workspace root の外側は編集しない',
			'差分方針は最小差分を基本にし、必要な変更だけを提案する',
			'失敗時の戻し方は、元ファイルの復元または差分の取り消しで案内する',
			'実際の編集前に、内容を確認できる説明を必ず挟む',
		],
	};
}

export function createIdleWorkspaceFileEditState(workspaceRoot = ''): WorkspaceFileEditState {
	return {
		status: 'idle',
		title: '待機中',
		workspaceRoot,
		relativePath: '',
		content: '',
		safetyNotice: createWorkspaceFileEditSafetyNotice(),
		timestamp: new Date().toISOString(),
		canRetry: false,
	};
}

export function createSavingWorkspaceFileEditState(input: {
	workspaceRoot: string;
	relativePath: string;
	content: string;
}) {
	return {
		status: 'saving' as const,
		title: '保存中',
		workspaceRoot: input.workspaceRoot,
		relativePath: input.relativePath,
		content: input.content,
		safetyNotice: createWorkspaceFileEditSafetyNotice(),
		timestamp: new Date().toISOString(),
		canRetry: false,
	};
}

export function createSuccessWorkspaceFileEditState(input: {
	workspaceRoot: string;
	relativePath: string;
	content: string;
	resultPath: string;
}) {
	return {
		status: 'success' as const,
		title: '保存完了',
		workspaceRoot: input.workspaceRoot,
		relativePath: input.relativePath,
		content: input.content,
		resultPath: input.resultPath,
		safetyNotice: createWorkspaceFileEditSafetyNotice(),
		timestamp: new Date().toISOString(),
		canRetry: true,
	};
}

export function createErrorWorkspaceFileEditState(input: {
	workspaceRoot: string;
	relativePath: string;
	content: string;
	errorMessage: string;
}) {
	return {
		status: 'error' as const,
		title: '保存失敗',
		workspaceRoot: input.workspaceRoot,
		relativePath: input.relativePath,
		content: input.content,
		errorMessage: input.errorMessage,
		safetyNotice: createWorkspaceFileEditSafetyNotice(),
		timestamp: new Date().toISOString(),
		canRetry: true,
	};
}
