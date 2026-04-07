import { createErrorAgentToolFileEditState, type AppState, type AgentToolFileEditState } from '../../../core/index';
import type { VsCodeApi } from '../types';

export type UseAgentToolFileEditParams = {
	vscode?: VsCodeApi;
	fileEditRelativePath: string;
	fileEditContent: string;
	setAgentToolFileEdit: (
		value: AgentToolFileEditState | ((current: AgentToolFileEditState) => AgentToolFileEditState),
	) => void;
	setBootstrapState: (value: AppState | ((current: AppState) => AppState)) => void;
};

export function useAgentToolFileEdit({
	vscode,
	fileEditRelativePath,
	fileEditContent,
	setAgentToolFileEdit,
	setBootstrapState,
}: UseAgentToolFileEditParams) {
	function submitAgentToolFileEdit() {
		const relativePath = fileEditRelativePath.trim();
		const content = fileEditContent;

		if (relativePath.length === 0) {
			const errorState = createErrorAgentToolFileEditState({
				workspaceRoot: '',
				relativePath: '',
				content,
				errorMessage: '編集対象のファイルパスを入力してください。',
			});
			setAgentToolFileEdit(errorState);
			setBootstrapState((current) => ({
				...current,
				agentToolFileEdit: errorState,
				statusMessage: '編集対象のファイルパスが未入力です。',
				errorMessage: errorState.errorMessage,
			}));
			return;
		}

		if (!vscode) {
			const errorState = createErrorAgentToolFileEditState({
				workspaceRoot: '',
				relativePath,
				content,
				errorMessage: 'VSCode API が見つからないため、ファイル保存は実行できません。',
			});
			setAgentToolFileEdit(errorState);
			setBootstrapState((current) => ({
				...current,
				agentToolFileEdit: errorState,
				statusMessage: 'ローカルプレビューではファイル保存できません。',
				errorMessage: errorState.errorMessage,
			}));
			return;
		}

		vscode.postMessage({
			type: 'request-agent-tool-file-edit',
			relativePath,
			content,
		});
		setAgentToolFileEdit((current) => ({
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
			agentToolFileEdit: {
				...current.agentToolFileEdit,
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

	return { submitAgentToolFileEdit };
}
