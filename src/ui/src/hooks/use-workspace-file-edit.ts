import { createErrorWorkspaceFileEditState, type AppState, type WorkspaceFileEditState } from '../../../core/index';
import type { VsCodeApi } from '../types';

export type UseWorkspaceFileEditParams = {
	vscode?: VsCodeApi;
	fileEditRelativePath: string;
	fileEditContent: string;
	setWorkspaceFileEdit: (value: WorkspaceFileEditState | ((current: WorkspaceFileEditState) => WorkspaceFileEditState)) => void;
	setBootstrapState: (value: AppState | ((current: AppState) => AppState)) => void;
};

export function useWorkspaceFileEdit({
	vscode,
	fileEditRelativePath,
	fileEditContent,
	setWorkspaceFileEdit,
	setBootstrapState,
}: UseWorkspaceFileEditParams) {
	function submitWorkspaceFileEdit() {
		const relativePath = fileEditRelativePath.trim();
		const content = fileEditContent;

		if (relativePath.length === 0) {
			const errorState = createErrorWorkspaceFileEditState({
				workspaceRoot: '',
				relativePath: '',
				content,
				errorMessage: '編集対象のファイルパスを入力してください。',
			});
			setWorkspaceFileEdit(errorState);
			setBootstrapState((current) => ({
				...current,
				workspaceFileEdit: errorState,
				statusMessage: '編集対象のファイルパスが未入力です。',
				errorMessage: errorState.errorMessage,
			}));
			return;
		}

		if (!vscode) {
			const errorState = createErrorWorkspaceFileEditState({
				workspaceRoot: '',
				relativePath,
				content,
				errorMessage: 'VSCode API が見つからないため、ファイル保存は実行できません。',
			});
			setWorkspaceFileEdit(errorState);
			setBootstrapState((current) => ({
				...current,
				workspaceFileEdit: errorState,
				statusMessage: 'ローカルプレビューではファイル保存できません。',
				errorMessage: errorState.errorMessage,
			}));
			return;
		}

		vscode.postMessage({
			type: 'request-workspace-file-edit',
			relativePath,
			content,
		});
		setWorkspaceFileEdit((current) => ({
			...current,
			status: 'saving',
			title: '保存中',
			relativePath,
			content,
			canRetry: false,
			timestamp: new Date().toISOString(),
		}));
		setBootstrapState((current) => ({
			...current,
			workspaceFileEdit: {
				...current.workspaceFileEdit,
				status: 'saving',
				title: '保存中',
				relativePath,
				content,
				canRetry: false,
				timestamp: new Date().toISOString(),
			},
			statusMessage: 'ファイルを保存しています。',
			errorMessage: undefined,
		}));
	}

	return { submitWorkspaceFileEdit };
}
