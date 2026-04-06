const fs = require('node:fs');
const path = require('node:path');
const vscode = require('vscode');

const VIEW_ID = 'perModelSettingAgent.demoView';
const VIEW_CONTAINER_ID = 'perModelSettingAgentContainer';

class DemoWebviewViewProvider {
	constructor(extensionPath) {
		this.extensionPath = extensionPath;
	}

	resolveWebviewView(webviewView) {
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.file(getUiDistPath(this.extensionPath))],
		};
		webviewView.webview.html = getWebviewHtml(webviewView.webview, this.extensionPath);
	}
}

function activate(context) {
	const provider = new DemoWebviewViewProvider(context.extensionPath);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(VIEW_ID, provider, {
			webviewOptions: {
				retainContextWhenHidden: true,
			},
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('perModelSettingAgent.openDemo', async () => {
			try {
				await vscode.commands.executeCommand(`workbench.view.extension.${VIEW_CONTAINER_ID}`);
			} catch {
				await vscode.window.showInformationMessage('左の Activity Bar にある Per Model Setting Agent をクリックしてください。');
			}
		}),
	);

	context.subscriptions.push(
		vscode.commands.registerCommand('perModelSettingAgent.moveToSecondarySideBar', async () => {
			try {
				await vscode.commands.executeCommand('workbench.action.moveFocusedView');
			} catch {
				await vscode.window.showInformationMessage('ビューを右 pane に移すには、表示中のビューを Secondary Side Bar へドラッグしてください。');
			}
		}),
	);
}

function getUiDistPath(extensionPath) {
	return path.join(extensionPath, 'src', 'ui', 'dist');
}

function getWebviewHtml(webview, extensionPath) {
	const distPath = getUiDistPath(extensionPath);
	const indexPath = path.join(distPath, 'index.html');
	const source = fs.readFileSync(indexPath, 'utf8');
	const cspSource = webview.cspSource;

	return source
		.replace(/(src|href)="([^"]+)"/g, (fullMatch, attribute, value) => {
			if (value.startsWith('http:') || value.startsWith('https:') || value.startsWith('data:')) {
				return fullMatch;
			}

			const normalized = value.startsWith('./') ? value.slice(2) : value.startsWith('/') ? value.slice(1) : value;
			const filePath = path.join(distPath, normalized);
			const uri = webview.asWebviewUri(vscode.Uri.file(filePath));

			return `${attribute}="${uri}"`;
		})
		.replace(
			'<head>',
			`<head>
	<meta
		http-equiv="Content-Security-Policy"
		content="default-src 'none'; img-src ${cspSource} data:; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource}; font-src ${cspSource};"
	/>`,
		);
}

function deactivate() {}

module.exports = {
	activate,
	deactivate,
};
