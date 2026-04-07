import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import * as vscode from 'vscode';

import {
	createErrorWorkspaceFileEditState,
	createErrorWorkspaceExecutionState,
	createIdleWorkspaceExecutionState,
	createIdleWorkspaceFileEditState,
	createRunningWorkspaceExecutionState,
	createSavingWorkspaceFileEditState,
	createSuccessWorkspaceFileEditState,
	createSuccessWorkspaceExecutionState,
	createDefaultSettingConfig,
	hydrateSettingConfig,
	normalizeSettingConfig,
	serializeSettingConfig,
	type SettingConfig,
	type WorkspaceFileEditState,
	type WorkspaceExecutionState,
} from './core/index';
import {
	executeWorkspacePromptStream,
	formatWorkspaceAgentError,
	type WorkspaceAgentResult,
} from './host/workspace-agent';
import { collectWorkspaceContext } from './host/workspace-context';
import { writeWorkspaceFileSafely } from './host/workspace-file-tools';

const VIEW_ID = 'perModelSettingAgent.demoView';
const VIEW_CONTAINER_ID = 'perModelSettingAgentContainer';
const SECRET_PREFIX = 'permosa.provider.apiKey.';
const SETTINGS_PANEL_VIEW_TYPE = 'perModelSettingAgent.settingsPanel';

type WebviewSurface = 'workspace' | 'settings';

type WebviewState = {
	surface: WebviewSurface;
	setting: SettingConfig;
	workspaceExecution: WorkspaceExecutionState;
	workspaceFileEdit: WorkspaceFileEditState;
	filePath: string;
	loadMode: 'default' | 'loaded' | 'corrupt';
	message: string;
	errorMessage?: string;
	lastSavedAt?: string;
};

type WebviewMessage =
	| {
			type: 'request-state';
	  }
	| {
			type: 'save-state';
			setting: SettingConfig;
	  }
	| {
			type: 'run-workspace-agent';
			setting: SettingConfig;
			prompt: string;
			conversation: WorkspaceExecutionState['messages'];
	  }
	| {
			type: 'request-workspace-file-edit';
			relativePath: string;
			content: string;
	  };

type IncomingWebviewMessage = WebviewMessage | { type: 'open-settings-panel' } | { type: 'open-main-panel' };

class SettingWebviewController implements vscode.WebviewViewProvider {
	private view?: vscode.WebviewView;
	private readonly panels = new Set<vscode.WebviewPanel>();

	private state: Omit<WebviewState, 'surface'> = (() => {
		const setting = createDefaultSettingConfig();
		const workspaceRoot = collectWorkspaceContext().workspacePath;

		return {
			setting,
			workspaceExecution: createIdleWorkspaceExecutionState(setting),
			workspaceFileEdit: createIdleWorkspaceFileEditState(workspaceRoot),
			filePath: getSettingsFilePath(),
			loadMode: 'default',
			message: '初期設定を読み込んでいます。',
		};
	})();

	constructor(private readonly context: vscode.ExtensionContext) {}

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

	private async loadState(): Promise<Omit<WebviewState, 'surface'>> {
		const filePath = getSettingsFilePath();
		const defaultState = createDefaultSettingConfig();
		const workspaceRoot = collectWorkspaceContext().workspacePath;

		try {
			const persisted = await readPersistedSettingFile(filePath);
			if (!persisted) {
				return {
					setting: defaultState,
					workspaceExecution: createIdleWorkspaceExecutionState(defaultState),
					workspaceFileEdit: createIdleWorkspaceFileEditState(workspaceRoot),
					filePath,
					loadMode: 'default',
					message: '設定ファイルが見つかりません。既定の provider / model を表示しています。',
				};
			}

			const providerApiKeys = await readProviderApiKeys(this.context, persisted.providers);
			const setting = hydrateSettingConfig(persisted, providerApiKeys);

			return {
				setting,
				workspaceExecution: createIdleWorkspaceExecutionState(setting),
				workspaceFileEdit: createIdleWorkspaceFileEditState(workspaceRoot),
				filePath,
				loadMode: 'loaded',
				message: '設定ファイルを読み込みました。',
			};
		} catch (error) {
			return {
				setting: defaultState,
				workspaceExecution: createIdleWorkspaceExecutionState(defaultState),
				workspaceFileEdit: createIdleWorkspaceFileEditState(workspaceRoot),
				filePath,
				loadMode: 'corrupt',
				message: '設定ファイルの読み込みに失敗しました。既定の provider / model を表示しています。',
				errorMessage: error instanceof Error ? error.message : String(error),
			};
		}
	}

	private async saveState(nextSetting: SettingConfig) {
		try {
			const normalized = normalizeSettingConfig(nextSetting);
			const persisted = serializeSettingConfig(normalized);
			await ensureSettingsDirectory();
			await fs.writeFile(getSettingsFilePath(), `${JSON.stringify(persisted, null, 2)}\n`, 'utf8');
			await persistProviderApiKeys(this.context, this.state.setting.providers, normalized.providers);
			const workspaceExecution =
				this.state.workspaceExecution.status === 'running'
					? this.state.workspaceExecution
					: createIdleWorkspaceExecutionState(normalized);

			this.state = {
				...this.state,
				setting: normalized,
				workspaceExecution,
				filePath: getSettingsFilePath(),
				loadMode: 'loaded',
				message: '設定を保存しました。',
				lastSavedAt: new Date().toISOString(),
			};

			await this.broadcastState();
		} catch (error) {
			this.state = {
				...this.state,
				message: '設定の保存に失敗しました。',
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

	private async runWorkspaceAgent(
		setting: SettingConfig,
		prompt: string,
		conversation: WorkspaceExecutionState['messages'] = [],
	) {
		const normalizedSetting = normalizeSettingConfig(setting);
		const normalizedPrompt = prompt.trim();
		const runningState = createRunningWorkspaceExecutionState(
			normalizedSetting,
			normalizedPrompt,
			this.state.workspaceExecution.messages,
		);
		let currentExecutionState = runningState;

		this.state = {
			...this.state,
			setting: normalizedSetting,
			workspaceExecution: runningState,
			message: 'Agent を実行しています。',
			errorMessage: undefined,
		};

		await this.broadcastMessage({
			type: 'workspace-execution-state',
			state: runningState,
		});

		try {
			const result = await executeWorkspacePromptStream(normalizedSetting, normalizedPrompt, {
				conversation,
				onStart: async (event) => {
					await this.broadcastMessage({
						type: 'workspace-execution-stream-start',
						event,
					});
				},
				onDelta: async (event) => {
					currentExecutionState = updateWorkspaceExecutionStreamingText(currentExecutionState, event.accumulatedText);
					this.state = {
						...this.state,
						workspaceExecution: currentExecutionState,
					};

					await this.broadcastMessage({
						type: 'workspace-execution-stream-delta',
						event,
					});
				},
				onComplete: async (event) => {
					currentExecutionState = updateWorkspaceExecutionStreamingText(currentExecutionState, event.text);
					await this.broadcastMessage({
						type: 'workspace-execution-stream-complete',
						event,
					});
				},
				onError: async (event) => {
					await this.broadcastMessage({
						type: 'workspace-execution-stream-error',
						event,
					});
				},
			});
			const appliedEdits = await this.applyWorkspaceAgentFileEdits(result);
			const response = buildWorkspaceAgentResponseText(result, appliedEdits);
			const successState = createSuccessWorkspaceExecutionState(
				normalizedSetting,
				normalizedPrompt,
				response,
				currentExecutionState.messages,
			);

			this.state = {
				...this.state,
				setting: normalizedSetting,
				workspaceExecution: successState,
				message: 'Agent から応答が届きました。',
				errorMessage: undefined,
			};

			await this.broadcastMessage({
				type: 'workspace-execution-state',
				state: successState,
			});
		} catch (error) {
			const errorMessage = formatWorkspaceAgentError(error);
			const errorState = createErrorWorkspaceExecutionState(
				normalizedSetting,
				normalizedPrompt,
				errorMessage,
				currentExecutionState.response,
				currentExecutionState.messages,
			);

			this.state = {
				...this.state,
				setting: normalizedSetting,
				workspaceExecution: errorState,
				message: 'Agent の実行に失敗しました。',
				errorMessage,
			};

			await this.broadcastMessage({
				type: 'workspace-execution-state',
				state: errorState,
			});
		}
	}

	private async applyWorkspaceAgentFileEdits(result: WorkspaceAgentResult) {
		const workspaceContext = collectWorkspaceContext();
		if (!workspaceContext.workspacePath.trim() || result.fileEdits.length === 0) {
			return [];
		}

		const appliedEdits: Array<{ relativePath: string; absolutePath: string }> = [];

		for (const fileEdit of result.fileEdits) {
			const normalizedRelativePath = fileEdit.relativePath.trim();
			const savingState = createSavingWorkspaceFileEditState({
				workspaceRoot: workspaceContext.workspacePath,
				relativePath: normalizedRelativePath,
				content: fileEdit.content,
			});

			this.state = {
				...this.state,
				workspaceFileEdit: savingState,
				message: `ファイルを保存しています: ${normalizedRelativePath}`,
				errorMessage: undefined,
			};

			await this.broadcastMessage({
				type: 'workspace-file-edit-state',
				state: savingState,
			});

			let applied: { relativePath: string; absolutePath: string };
			try {
				applied = await writeWorkspaceFileSafely({
					workspaceRoot: workspaceContext.workspacePath,
					relativePath: normalizedRelativePath,
					content: fileEdit.content,
				});
			} catch (error) {
				const errorMessage = error instanceof Error ? error.message : String(error);
				const errorState = createErrorWorkspaceFileEditState({
					workspaceRoot: workspaceContext.workspacePath,
					relativePath: normalizedRelativePath,
					content: fileEdit.content,
					errorMessage,
				});

				this.state = {
					...this.state,
					workspaceFileEdit: errorState,
					message: 'ファイルの保存に失敗しました。',
					errorMessage,
				};

				await this.broadcastMessage({
					type: 'workspace-file-edit-state',
					state: errorState,
				});

				throw error;
			}

			const successState = createSuccessWorkspaceFileEditState({
				workspaceRoot: workspaceContext.workspacePath,
				relativePath: applied.relativePath,
				content: fileEdit.content,
				resultPath: applied.absolutePath,
			});

			this.state = {
				...this.state,
				workspaceFileEdit: successState,
				message: `ファイルを保存しました: ${applied.relativePath}`,
				errorMessage: undefined,
			};

			await this.broadcastMessage({
				type: 'workspace-file-edit-state',
				state: successState,
			});

			appliedEdits.push(applied);
		}

		return appliedEdits;
	}

	private async runWorkspaceFileEdit(relativePath: string, content: string) {
		const workspaceContext = collectWorkspaceContext();
		const normalizedRelativePath = relativePath.trim();
		const normalizedContent = content;
		const savingState = createSavingWorkspaceFileEditState({
			workspaceRoot: workspaceContext.workspacePath,
			relativePath: normalizedRelativePath,
			content: normalizedContent,
		});

		this.state = {
			...this.state,
			workspaceFileEdit: savingState,
			message: 'ファイルを保存しています。',
			errorMessage: undefined,
		};

		await this.broadcastMessage({
			type: 'workspace-file-edit-state',
			state: savingState,
		});

		try {
			const result = await writeWorkspaceFileSafely({
				workspaceRoot: workspaceContext.workspacePath,
				relativePath: normalizedRelativePath,
				content: normalizedContent,
			});
			const successState = createSuccessWorkspaceFileEditState({
				workspaceRoot: workspaceContext.workspacePath,
				relativePath: normalizedRelativePath,
				content: normalizedContent,
				resultPath: result.absolutePath,
			});

			this.state = {
				...this.state,
				workspaceFileEdit: successState,
				message: `ファイルを保存しました: ${result.relativePath}`,
				errorMessage: undefined,
			};

			await this.broadcastMessage({
				type: 'workspace-file-edit-state',
				state: successState,
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorState = createErrorWorkspaceFileEditState({
				workspaceRoot: workspaceContext.workspacePath,
				relativePath: normalizedRelativePath,
				content: normalizedContent,
				errorMessage,
			});

			this.state = {
				...this.state,
				workspaceFileEdit: errorState,
				message: 'ファイルの保存に失敗しました。',
				errorMessage,
			};

			await this.broadcastMessage({
				type: 'workspace-file-edit-state',
				state: errorState,
			});
		}
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

	private async broadcastMessage(message: unknown) {
		if (this.view) {
			await this.view.webview.postMessage(message);
		}

		for (const panel of this.panels) {
			await panel.webview.postMessage(message);
		}
	}

	private buildState(surface: WebviewSurface): WebviewState {
		return {
			...this.state,
			surface,
		};
	}

	private registerMessageHandlers(webview: vscode.Webview, surface: WebviewSurface) {
		webview.onDidReceiveMessage(async (message: IncomingWebviewMessage) => {
			if (message.type === 'request-state') {
				await webview.postMessage({
					type: 'state-saved',
					state: this.buildState(surface),
				});
				return;
			}

			if (message.type === 'save-state') {
				await this.saveState(message.setting);
				return;
			}

			if (message.type === 'run-workspace-agent') {
				await this.runWorkspaceAgent(message.setting, message.prompt, message.conversation);
				return;
			}

			if (message.type === 'request-workspace-file-edit') {
				await this.runWorkspaceFileEdit(message.relativePath, message.content);
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

export function activate(context: vscode.ExtensionContext) {
	const provider = new SettingWebviewController(context);

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

export function deactivate() {}

function getSettingsFilePath() {
	return path.join(os.homedir(), '.permosa', 'setting.json');
}

async function ensureSettingsDirectory() {
	await fs.mkdir(path.dirname(getSettingsFilePath()), { recursive: true });
}

async function readPersistedSettingFile(filePath: string) {
	try {
		const raw = await fs.readFile(filePath, 'utf8');
		const parsed = JSON.parse(raw) as unknown;
		return normalizeSettingConfig(parsed as Partial<SettingConfig>);
	} catch (error) {
		if (isFileNotFound(error)) {
			return undefined;
		}

		throw error;
	}
}

function isFileNotFound(error: unknown) {
	return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT';
}

async function readProviderApiKeys(context: vscode.ExtensionContext, providers: SettingConfig['providers']) {
	const entries = await Promise.all(
		providers.map(async (provider) => {
			const key = await context.secrets.get(getProviderSecretKey(provider.id));
			return [provider.id, key ?? ''] as const;
		}),
	);

	return Object.fromEntries(entries);
}

async function persistProviderApiKeys(
	context: vscode.ExtensionContext,
	previousProviders: SettingConfig['providers'],
	nextProviders: SettingConfig['providers'],
) {
	const previousIds = new Set(previousProviders.map((provider) => provider.id));
	const nextIds = new Set(nextProviders.map((provider) => provider.id));

	for (const provider of previousProviders) {
		if (!nextIds.has(provider.id)) {
			await context.secrets.delete(getProviderSecretKey(provider.id));
		}
	}

	for (const provider of nextProviders) {
		const secretKey = getProviderSecretKey(provider.id);
		const apiKey = provider.apiKey?.trim() ?? '';

		if (apiKey.length > 0) {
			await context.secrets.store(secretKey, apiKey);
			continue;
		}

		if (previousIds.has(provider.id)) {
			await context.secrets.delete(secretKey);
		}
	}
}

function getProviderSecretKey(providerId: string) {
	return `${SECRET_PREFIX}${providerId}`;
}

function getUiDistPath(extensionUri: vscode.Uri) {
	return vscode.Uri.joinPath(extensionUri, 'src', 'ui', 'dist');
}

function updateWorkspaceExecutionStreamingText(
	executionState: WorkspaceExecutionState,
	accumulatedText: string,
) {
	const timestamp = new Date().toISOString();
	const messages = executionState.messages.map((message) => {
		if (
			(executionState.streamingMessageId && message.id === executionState.streamingMessageId) ||
			(!executionState.streamingMessageId && message.role === 'assistant' && message.status === 'streaming')
		) {
			return {
				...message,
				content: accumulatedText,
				status: 'streaming' as const,
				timestamp,
			};
		}

		return message;
	});

	return {
		...executionState,
		response: accumulatedText,
		messages,
	};
}

function buildWorkspaceAgentResponseText(
	result: WorkspaceAgentResult,
	appliedEdits: Array<{ relativePath: string; absolutePath: string }>,
) {
	const assistantMessage = result.assistantMessage.trim();
	if (appliedEdits.length === 0) {
		return assistantMessage;
	}

	const editSummary = appliedEdits.map((edit) => `- ${edit.relativePath}`).join('\n');
	return [assistantMessage, '作成・更新したファイル:', editSummary].filter((value) => value.trim().length > 0).join('\n\n');
}

function serializeStateForScript(state: WebviewState) {
	return JSON.stringify(state)
		.replace(/</g, '\\u003c')
		.replace(/\u2028/g, '\\u2028')
		.replace(/\u2029/g, '\\u2029');
}

async function getWebviewHtml(webview: vscode.Webview, extensionUri: vscode.Uri, state: WebviewState) {
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
