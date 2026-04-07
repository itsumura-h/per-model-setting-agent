import * as vscode from 'vscode';

import { SettingsWebviewController, settingsWebviewContainerId, settingsWebviewViewId } from './host/webview-controller';

export function activate(context: vscode.ExtensionContext) {
	const provider = new SettingsWebviewController(context);

	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(settingsWebviewViewId, provider, {
			webviewOptions: {
				retainContextWhenHidden: true,
			},
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('permosa.openWorkspace', async () => {
			try {
				await vscode.commands.executeCommand(`workbench.view.extension.${settingsWebviewContainerId}`);
			} catch {
				await vscode.window.showInformationMessage('左の Activity Bar にある Per Model Setting Agent をクリックしてください。');
			}
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('permosa.moveToSecondarySideBar', async () => {
			try {
				await vscode.commands.executeCommand('workbench.action.moveFocusedView');
			} catch {
				await vscode.window.showInformationMessage('ビューを右 pane に移すには、表示中のビューを Secondary Side Bar へドラッグしてください。');
			}
		}),
	);
}

export function deactivate() {}
