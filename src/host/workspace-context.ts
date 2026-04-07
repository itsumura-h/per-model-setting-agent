import * as vscode from 'vscode';

export type WorkspaceContextSnapshot = {
	workspaceName: string;
	workspacePath: string;
	activeFilePath: string;
	activeSelectionPreview: string;
	openEditors: string[];
};

function previewText(value: string, maxLength = 240) {
	const normalized = value.replace(/\s+/g, ' ').trim();
	if (normalized.length <= maxLength) {
		return normalized;
	}

	return `${normalized.slice(0, maxLength)}…`;
}

export function collectWorkspaceContext(): WorkspaceContextSnapshot {
	const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
	const activeEditor = vscode.window.activeTextEditor;
	const openEditors = [...new Set(vscode.window.visibleTextEditors.map((editor) => editor.document.uri.fsPath))];

	return {
		workspaceName: workspaceFolder?.name ?? 'Workspace',
		workspacePath: workspaceFolder?.uri.fsPath ?? '',
		activeFilePath: activeEditor?.document.uri.fsPath ?? '',
		activeSelectionPreview:
			activeEditor && !activeEditor.selection.isEmpty
				? previewText(activeEditor.document.getText(activeEditor.selection))
				: '',
		openEditors,
	};
}

export function formatWorkspaceContextForPrompt(context: WorkspaceContextSnapshot) {
	const lines = [
		`Workspace name: ${context.workspaceName}`,
		`Workspace path: ${context.workspacePath || 'unavailable'}`,
		`Active file: ${context.activeFilePath || 'none'}`,
		`Active selection: ${context.activeSelectionPreview || 'none'}`,
		`Open editors: ${context.openEditors.length > 0 ? context.openEditors.join(', ') : 'none'}`,
	];

	return lines.join('\n');
}
