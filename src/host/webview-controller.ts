import fs from 'node:fs/promises';

import * as vscode from 'vscode';

import {
	createDefaultSettingsConfig,
	createIdleWorkspaceExecutionState,
	createIdleAgentToolFileEditState,
	hydrateSettingsConfig,
	normalizeSettingsConfig,
	remapWorkspaceExecutionForSetting,
	serializeSettingsConfig,
	type AppState,
	type ExtensionMessage,
	type IncomingWebviewMessage,
	type SettingsConfig,
	type ViewMode,
} from '../core/index';
import { runAgentToolFileEdit, runWorkspaceAgent, type ControllerState, type OrchestrationAccess } from './agent-orchestrator';
import { collectWorkspaceContext } from './workspace-context';
import { ensureSettingsDirectory, getSettingsFilePath, readPersistedSettingsFile } from './settings-persistence';
import { persistProviderApiKeys, readProviderApiKeys } from './secret-storage';
import { getWebviewHtml } from './webview-html';

const VIEW_ID = 'permosa.workspaceView';
const VIEW_CONTAINER_ID = 'permosaContainer';
const SETTINGS_PANEL_VIEW_TYPE = 'permosa.settingsPanel';

export class SettingsWebviewController implements vscode.WebviewViewProvider {
	private view?: vscode.WebviewView;
	private readonly panels = new Set<vscode.WebviewPanel>();

	private state: ControllerState = (() => {
		const settings = createDefaultSettingsConfig();
		const workspaceRoot = collectWorkspaceContext().workspacePath;

		return {
			settings,
			workspaceExecution: createIdleWorkspaceExecutionState(settings),
			agentToolFileEdit: createIdleAgentToolFileEditState(workspaceRoot),
			filePath: getSettingsFilePath(),
			loadStatus: 'fallback',
			statusMessage: '初期設定を読み込んでいます。',
		};
	})();

	constructor(private readonly context: vscode.ExtensionContext) {}

	private get orchestrationAccess(): OrchestrationAccess {
		return {
			getState: () => this.state,
			setState: (next) => {
				this.state = next;
			},
			broadcastMessage: (message) => this.broadcastMessage(message),
		};
	}

	async resolveWebviewView(webviewView: vscode.WebviewView): Promise<void> {
		this.view = webviewView;
		const webview = webviewView.webview;
		webview.options = {
			enableScripts: true,
			localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'src', 'ui', 'dist')],
		};

		this.state = await this.loadState();
		webview.html = await getWebviewHtml(webview, this.context.extensionUri, this.buildState('workspace'));
		this.registerMessageHandlers(webview, 'workspace');

		webviewView.onDidDispose(() => {
			if (this.view === webviewView) {
				this.view = undefined;
			}
		});
	}

	private async loadState(): Promise<ControllerState> {
		const filePath = getSettingsFilePath();
		const defaultSettings = createDefaultSettingsConfig();
		const workspaceRoot = collectWorkspaceContext().workspacePath;

		try {
			const persisted = await readPersistedSettingsFile(filePath);
			if (!persisted) {
				return {
					settings: defaultSettings,
					workspaceExecution: createIdleWorkspaceExecutionState(defaultSettings),
					agentToolFileEdit: createIdleAgentToolFileEditState(workspaceRoot),
					filePath,
					loadStatus: 'fallback',
					statusMessage: '設定ファイルが見つかりません。既定の provider / model を表示しています。',
				};
			}

			const providerApiKeys = await readProviderApiKeys(this.context, persisted.providers);
			const settings = hydrateSettingsConfig(persisted, providerApiKeys);

			return {
				settings,
				workspaceExecution: createIdleWorkspaceExecutionState(settings),
				agentToolFileEdit: createIdleAgentToolFileEditState(workspaceRoot),
				filePath,
				loadStatus: 'loaded',
				statusMessage: '設定ファイルを読み込みました。',
			};
		} catch (error) {
			return {
				settings: defaultSettings,
				workspaceExecution: createIdleWorkspaceExecutionState(defaultSettings),
				agentToolFileEdit: createIdleAgentToolFileEditState(workspaceRoot),
				filePath,
				loadStatus: 'corrupt',
				statusMessage: '設定ファイルの読み込みに失敗しました。既定の provider / model を表示しています。',
				errorMessage: error instanceof Error ? error.message : String(error),
			};
		}
	}

	private async saveState(nextSettings: SettingsConfig) {
		try {
			const normalized = normalizeSettingsConfig(nextSettings);
			const persisted = serializeSettingsConfig(normalized);
			await ensureSettingsDirectory();
			await fs.writeFile(getSettingsFilePath(), `${JSON.stringify(persisted, null, 2)}\n`, 'utf8');
			await persistProviderApiKeys(this.context, this.state.settings.providers, normalized.providers);
			const workspaceExecution = remapWorkspaceExecutionForSetting(this.state.workspaceExecution, normalized);

			this.state = {
				...this.state,
				settings: normalized,
				workspaceExecution,
				filePath: getSettingsFilePath(),
				loadStatus: 'loaded',
				statusMessage: '設定を保存しました。',
				lastSavedAt: new Date().toISOString(),
			};

			await this.broadcastState();
		} catch (error) {
			this.state = {
				...this.state,
				statusMessage: '設定の保存に失敗しました。',
				errorMessage: error instanceof Error ? error.message : String(error),
			};
			await this.broadcastMessage({
				type: 'state-error',
				message: this.state.errorMessage ?? '設定の保存に失敗しました。',
			});
		}
	}

	private async openSettingsPanel() {
		const existingPanel = [...this.panels][0];
		if (existingPanel) {
			existingPanel.reveal(vscode.ViewColumn.Active);
			return;
		}

		const panel = vscode.window.createWebviewPanel(
			SETTINGS_PANEL_VIEW_TYPE,
			'Per Model Setting Agent: Settings',
			vscode.ViewColumn.Active,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
				localResourceRoots: [vscode.Uri.joinPath(this.context.extensionUri, 'src', 'ui', 'dist')],
			},
		);

		this.panels.add(panel);
		panel.onDidDispose(() => {
			this.panels.delete(panel);
		});

		panel.webview.html = await getWebviewHtml(panel.webview, this.context.extensionUri, this.buildState('settings'));
		this.registerMessageHandlers(panel.webview, 'settings');
	}

	private async broadcastState() {
		await this.broadcastMessage({
			type: 'state-saved',
			state: this.buildState('workspace'),
		});
		await this.broadcastToSettingsPanels();
	}

	private async broadcastToSettingsPanels() {
		for (const panel of this.panels) {
			await panel.webview.postMessage({
				type: 'state-saved',
				state: this.buildState('settings'),
			});
		}
	}

	private async broadcastMessage(message: ExtensionMessage) {
		if (this.view) {
			await this.view.webview.postMessage(message);
		}

		for (const panel of this.panels) {
			await panel.webview.postMessage(message);
		}
	}

	private buildState(viewMode: ViewMode): AppState {
		return {
			...this.state,
			viewMode,
		};
	}

	private registerMessageHandlers(webview: vscode.Webview, viewMode: ViewMode) {
		webview.onDidReceiveMessage(async (message: IncomingWebviewMessage) => {
			if (message.type === 'request-state') {
				await webview.postMessage({
					type: 'state-saved',
					state: this.buildState(viewMode),
				});
				return;
			}

			if (message.type === 'save-state') {
				await this.saveState(message.settings);
				return;
			}

			if (message.type === 'run-workspace-agent') {
				await runWorkspaceAgent(this.orchestrationAccess, message.settings, message.prompt, message.conversation);
				return;
			}

			if (message.type === 'request-agent-tool-file-edit') {
				await runAgentToolFileEdit(this.orchestrationAccess, message.relativePath, message.content);
				return;
			}

			if (message.type === 'open-settings-panel') {
				await this.openSettingsPanel();
				return;
			}

			if (message.type === 'open-main-panel') {
				await vscode.commands.executeCommand(`workbench.view.extension.${VIEW_CONTAINER_ID}`);
			}
		});
	}
}

export const settingsWebviewViewId = VIEW_ID;
export const settingsWebviewContainerId = VIEW_CONTAINER_ID;
