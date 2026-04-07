import fs from 'node:fs/promises';
import path from 'node:path';

import * as vscode from 'vscode';

import type { AppState } from '../core/index';

export function getUiDistPath(extensionUri: vscode.Uri) {
	return vscode.Uri.joinPath(extensionUri, 'src', 'ui', 'dist');
}

export function serializeStateForScript(state: AppState) {
	return JSON.stringify(state)
		.replace(/</g, '\\u003c')
		.replace(/\u2028/g, '\\u2028')
		.replace(/\u2029/g, '\\u2029');
}

export async function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri, state: AppState) {
	const distUri = getUiDistPath(extensionUri);
	const indexPath = vscode.Uri.joinPath(distUri, 'index.html');
	const source = await fs.readFile(indexPath.fsPath, 'utf8');
	const cspSource = webview.cspSource;
	const serializedState = serializeStateForScript(state);

	return source
		.replace(/(src|href)="([^"]+)"/g, (fullMatch, attribute, value) => {
			if (value.startsWith('http:') || value.startsWith('https:') || value.startsWith('data:')) {
				return fullMatch;
			}

			const normalized = value.startsWith('./') ? value.slice(2) : value.startsWith('/') ? value.slice(1) : value;
			const filePath = path.join(distUri.fsPath, normalized);
			const uri = webview.asWebviewUri(vscode.Uri.file(filePath));

			return `${attribute}="${uri}"`;
		})
		.replace(
			'<head>',
			`<head>
	<meta
		http-equiv="Content-Security-Policy"
		content="default-src 'none'; img-src ${cspSource} data:; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource}; font-src ${cspSource};"
	/>
	<script id="permosa-initial-state" type="application/json">${serializedState}</script>`,
		);
}
