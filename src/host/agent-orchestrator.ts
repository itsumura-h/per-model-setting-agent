import {
	createErrorWorkspaceExecutionState,
	createErrorWorkspaceFileEditState,
	createRunningWorkspaceExecutionState,
	createSavingWorkspaceFileEditState,
	createSuccessWorkspaceExecutionState,
	createSuccessWorkspaceFileEditState,
	normalizeSettingsConfig,
	updateWorkspaceExecutionStreamingText,
	type AppState,
	type ExtensionMessage,
	type SettingsConfig,
	type WorkspaceExecutionState,
} from '../core/index';
import { executeWorkspacePromptStream, formatAgentError, type AgentResult } from './workspace-agent';
import { collectWorkspaceContext } from './workspace-context';
import { writeWorkspaceFileSafely } from './workspace-file-tools';

export type ControllerState = Omit<AppState, 'viewMode'>;

export type OrchestrationAccess = {
	getState: () => ControllerState;
	setState: (next: ControllerState) => void;
	broadcastMessage: (message: ExtensionMessage) => Promise<void>;
};

export function buildAgentResponseText(
	result: AgentResult,
	appliedEdits: Array<{ relativePath: string; absolutePath: string }>,
) {
	const assistantMessage = result.assistantMessage.trim();
	if (appliedEdits.length === 0) {
		return assistantMessage;
	}

	const editSummary = appliedEdits.map((edit) => `- ${edit.relativePath}`).join('\n');
	return [assistantMessage, '作成・更新したファイル:', editSummary].filter((value) => value.trim().length > 0).join('\n\n');
}

export async function runWorkspaceAgent(
	access: OrchestrationAccess,
	settings: SettingsConfig,
	prompt: string,
	conversation: WorkspaceExecutionState['messages'] = [],
) {
	const normalizedSettings = normalizeSettingsConfig(settings);
	const normalizedPrompt = prompt.trim();
	const { getState, setState, broadcastMessage } = access;
	const runningState = createRunningWorkspaceExecutionState(
		normalizedSettings,
		normalizedPrompt,
		getState().workspaceExecution.messages,
	);
	let currentExecutionState = runningState;

	setState({
		...getState(),
		settings: normalizedSettings,
		workspaceExecution: runningState,
		statusMessage: 'Agent を実行しています。',
		errorMessage: undefined,
	});

	await broadcastMessage({
		type: 'workspace-execution-state',
		state: runningState,
	});

	try {
		const result = await executeWorkspacePromptStream(normalizedSettings, normalizedPrompt, {
			conversation,
			observer: {
				onStart: async (event) => {
					await broadcastMessage({
						type: 'workspace-execution-stream-start',
						event,
					});
				},
				onDelta: async (event) => {
					currentExecutionState = updateWorkspaceExecutionStreamingText(currentExecutionState, event.accumulatedText);
					setState({
						...getState(),
						workspaceExecution: currentExecutionState,
					});

					await broadcastMessage({
						type: 'workspace-execution-stream-delta',
						event,
					});
				},
				onComplete: async (event) => {
					currentExecutionState = updateWorkspaceExecutionStreamingText(currentExecutionState, event.text);
					await broadcastMessage({
						type: 'workspace-execution-stream-complete',
						event,
					});
				},
				onError: async (event) => {
					await broadcastMessage({
						type: 'workspace-execution-stream-error',
						event,
					});
				},
			},
		});
		const appliedEdits = await applyAgentFileEdits(access, result);
		const response = buildAgentResponseText(result, appliedEdits);
		const successState = createSuccessWorkspaceExecutionState(
			normalizedSettings,
			normalizedPrompt,
			response,
			currentExecutionState.messages,
		);

		setState({
			...getState(),
			settings: normalizedSettings,
			workspaceExecution: successState,
			statusMessage: 'Agent から応答が届きました。',
			errorMessage: undefined,
		});

		await broadcastMessage({
			type: 'workspace-execution-state',
			state: successState,
		});
	} catch (error) {
		const errorMessage = formatAgentError(error);
		const errorState = createErrorWorkspaceExecutionState(
			normalizedSettings,
			normalizedPrompt,
			errorMessage,
			currentExecutionState.response,
			currentExecutionState.messages,
		);

		setState({
			...getState(),
			settings: normalizedSettings,
			workspaceExecution: errorState,
			statusMessage: 'Agent の実行に失敗しました。',
			errorMessage,
		});

		await broadcastMessage({
			type: 'workspace-execution-state',
			state: errorState,
		});
	}
}

async function applyAgentFileEdits(access: OrchestrationAccess, result: AgentResult) {
	const workspaceContext = collectWorkspaceContext();
	if (!workspaceContext.workspacePath.trim() || result.fileEdits.length === 0) {
		return [];
	}

	const { getState, setState, broadcastMessage } = access;
	const appliedEdits: Array<{ relativePath: string; absolutePath: string }> = [];

	for (const fileEdit of result.fileEdits) {
		const normalizedRelativePath = fileEdit.relativePath.trim();
		const savingState = createSavingWorkspaceFileEditState({
			workspaceRoot: workspaceContext.workspacePath,
			relativePath: normalizedRelativePath,
			content: fileEdit.content,
		});

		setState({
			...getState(),
			workspaceFileEdit: savingState,
			statusMessage: `ファイルを保存しています: ${normalizedRelativePath}`,
			errorMessage: undefined,
		});

		await broadcastMessage({
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

			setState({
				...getState(),
				workspaceFileEdit: errorState,
				statusMessage: 'ファイルの保存に失敗しました。',
				errorMessage,
			});

			await broadcastMessage({
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

		setState({
			...getState(),
			workspaceFileEdit: successState,
			statusMessage: `ファイルを保存しました: ${applied.relativePath}`,
			errorMessage: undefined,
		});

		await broadcastMessage({
			type: 'workspace-file-edit-state',
			state: successState,
		});

		appliedEdits.push(applied);
	}

	return appliedEdits;
}

export async function runWorkspaceFileEdit(access: OrchestrationAccess, relativePath: string, content: string) {
	const workspaceContext = collectWorkspaceContext();
	const normalizedRelativePath = relativePath.trim();
	const normalizedContent = content;
	const { getState, setState, broadcastMessage } = access;
	const savingState = createSavingWorkspaceFileEditState({
		workspaceRoot: workspaceContext.workspacePath,
		relativePath: normalizedRelativePath,
		content: normalizedContent,
	});

	setState({
		...getState(),
		workspaceFileEdit: savingState,
		statusMessage: 'ファイルを保存しています。',
		errorMessage: undefined,
	});

	await broadcastMessage({
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

		setState({
			...getState(),
			workspaceFileEdit: successState,
			statusMessage: `ファイルを保存しました: ${result.relativePath}`,
			errorMessage: undefined,
		});

		await broadcastMessage({
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

		setState({
			...getState(),
			workspaceFileEdit: errorState,
			statusMessage: 'ファイルの保存に失敗しました。',
			errorMessage,
		});

		await broadcastMessage({
			type: 'workspace-file-edit-state',
			state: errorState,
		});
	}
}
