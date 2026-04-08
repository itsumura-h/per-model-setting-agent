import { randomUUID } from 'node:crypto';

import {
	createErrorAgentToolFileEditState,
	createErrorWorkspaceExecutionState,
	createRunningWorkspaceExecutionState,
	createSavingAgentToolFileEditState,
	createSuccessAgentToolFileEditState,
	createSuccessWorkspaceExecutionState,
	normalizeSettingsConfig,
	updateWorkspaceExecutionStreamingText,
	type AppState,
	type ExtensionMessage,
	type SettingsConfig,
	type WorkspaceConversationMessage,
	type WorkspaceExecutionState,
} from '../core/index';
import { executeWorkspacePromptStream, formatAgentError, type AgentResult } from './workspace-agent';
import {
	getFileEditOutputs,
	getFileReadOutputs,
	getListFilesOutputs,
	getShellExecOutputs,
	hasAnyToolOutputs,
} from './agent/agent-result';
import { buildToolFeedbackPrompt } from './agent/prompt-builder';
import { collectWorkspaceContext } from './workspace-context';
import { agentToolFileEditWrite, agentToolFileRead, agentToolListFiles, agentToolShellExec } from './agent-tools';

/** 中間ツールのみのターンのあと、ツール結果をモデルに返して続行する最大回数（初回含む） */
const MAX_TOOL_TURNS = 5;

export type ControllerState = Omit<AppState, 'viewMode'>;

export type OrchestrationAccess = {
	getState: () => ControllerState;
	setState: (next: ControllerState) => void;
	broadcastMessage: (message: ExtensionMessage) => Promise<void>;
};

export type AgentOrchestratorListFilesBlock = {
	pattern: string;
	files: string[];
	truncated: boolean;
	totalCount: number;
	errorMessage?: string;
};

export type AgentOrchestratorShellExecBlock = {
	command: string;
	cwd: string;
	stdout: string;
	stderr: string;
	exitCode: number | null;
	timedOut: boolean;
	truncated: boolean;
	errorMessage?: string;
};

export function buildAgentResponseText(
	result: AgentResult,
	appliedEdits: Array<{ relativePath: string; absolutePath: string }>,
	fileReadBlocks?: Array<{ relativePath: string; content: string }>,
	listFilesBlocks?: AgentOrchestratorListFilesBlock[],
	shellExecBlocks?: AgentOrchestratorShellExecBlock[],
) {
	const assistantMessage = result.assistantMessage.trim();
	const parts: string[] = [];

	if (assistantMessage.length > 0) {
		parts.push(assistantMessage);
	}

	if (listFilesBlocks && listFilesBlocks.length > 0) {
		for (const block of listFilesBlocks) {
			if (block.errorMessage) {
				parts.push(`### ファイル一覧 (${block.pattern})\n${block.errorMessage}`);
				continue;
			}

			const suffix = block.truncated ? '（件数上限により省略）' : '';
			const lines =
				block.files.length > 0 ? block.files.map((f) => `- ${f}`).join('\n') : '（該当なし）';
			parts.push([`### ファイル一覧 (${block.pattern})${suffix}`, lines, `件数: ${block.totalCount}`].join('\n\n'));
		}
	}

	if (shellExecBlocks && shellExecBlocks.length > 0) {
		for (const block of shellExecBlocks) {
			if (block.errorMessage) {
				parts.push(`### コマンド実行結果\n$ ${block.command}\n${block.errorMessage}`);
				continue;
			}

			const statusParts = [
				`終了コード: ${block.exitCode === null ? '（不明）' : String(block.exitCode)}`,
				block.timedOut ? 'タイムアウト' : null,
				block.truncated ? '出力が長いため切り詰め' : null,
			].filter((s): s is string => Boolean(s));

			parts.push(
				[
					'### コマンド実行結果',
					`$ ${block.command}`,
					`(cwd: ${block.cwd})`,
					'stdout:',
					`\`\`\`\n${block.stdout}\n\`\`\``,
					'stderr:',
					`\`\`\`\n${block.stderr}\n\`\`\``,
					statusParts.join(' / '),
				].join('\n\n'),
			);
		}
	}

	if (fileReadBlocks && fileReadBlocks.length > 0) {
		const blocks = fileReadBlocks.map(
			(read) => `### ${read.relativePath}\n\`\`\`\n${read.content}\n\`\`\``,
		);
		parts.push(['読み取ったファイル:', ...blocks].join('\n\n'));
	}

	if (appliedEdits.length > 0) {
		const editSummary = appliedEdits.map((edit) => `- ${edit.relativePath}`).join('\n');
		parts.push(['作成・更新したファイル:', editSummary].join('\n\n'));
	}

	return parts.filter((value) => value.trim().length > 0).join('\n\n');
}

function appendToolFeedbackMessages(state: WorkspaceExecutionState): WorkspaceExecutionState {
	const now = new Date().toISOString();
	const userId = `user-tool-feedback-${now}`;
	const assistantId = `assistant-${now}`;
	return {
		...state,
		messages: [
			...state.messages,
			{
				id: userId,
				role: 'user',
				title: 'ツール結果',
				content: 'ツール実行結果をモデルに渡して次の応答を生成しています。',
				status: 'complete',
				timestamp: now,
				canRetry: false,
			},
			{
				id: assistantId,
				role: 'assistant',
				title: '応答',
				content: '',
				status: 'streaming',
				timestamp: now,
				canRetry: false,
			},
		],
		streamingMessageId: assistantId,
	};
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
		let loopConversation: WorkspaceConversationMessage[] = [...conversation];
		let currentPrompt = normalizedPrompt;
		const accumulatedListFiles: AgentOrchestratorListFilesBlock[] = [];
		const accumulatedShellExec: AgentOrchestratorShellExecBlock[] = [];
		const accumulatedFileReads: Array<{ relativePath: string; content: string }> = [];
		const accumulatedEdits: Array<{ relativePath: string; absolutePath: string }> = [];
		let lastResult: AgentResult | undefined;
		let lastStreamText = '';

		for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
			setState({
				...getState(),
				statusMessage: `Agent を実行しています（${turn + 1}/${MAX_TOOL_TURNS}）。`,
			});

			lastStreamText = '';
			lastResult = await executeWorkspacePromptStream(normalizedSettings, currentPrompt, {
				conversation: loopConversation,
				toolActivationPrompt: normalizedPrompt,
				observer: {
					onStart: async (event) => {
						await broadcastMessage({
							type: 'workspace-execution-stream-start',
							event,
						});
					},
					onDelta: async (event) => {
						currentExecutionState = updateWorkspaceExecutionStreamingText(
							currentExecutionState,
							event.accumulatedText,
						);
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
						lastStreamText = event.text;
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

			const listFilesBlocks = await applyAgentToolListFiles(lastResult);
			const shellExecBlocks = await applyAgentToolShellExec(lastResult);
			const fileReadBlocks = await applyAgentToolFileReads(lastResult);
			const appliedEdits = await applyAgentToolFileEdits(access, lastResult);

			accumulatedListFiles.push(...listFilesBlocks);
			accumulatedShellExec.push(...shellExecBlocks);
			accumulatedFileReads.push(...fileReadBlocks);
			accumulatedEdits.push(...appliedEdits);

			const hasIntermediateOnly =
				(listFilesBlocks.length > 0 || shellExecBlocks.length > 0) &&
				fileReadBlocks.length === 0 &&
				appliedEdits.length === 0;

			const shouldContinueLoop =
				hasIntermediateOnly &&
				turn < MAX_TOOL_TURNS - 1 &&
				hasAnyToolOutputs(lastResult);

			if (!shouldContinueLoop) {
				break;
			}

			currentExecutionState = updateWorkspaceExecutionStreamingText(
				currentExecutionState,
				lastStreamText,
				{ assistantMessageStatus: 'complete' },
			);

			loopConversation = [
				...loopConversation,
				{
					id: `assistant-${randomUUID()}`,
					role: 'assistant',
					title: '応答',
					content: lastResult.assistantMessage.trim(),
					status: 'complete',
					timestamp: new Date().toISOString(),
					canRetry: false,
				},
			];

			currentPrompt = buildToolFeedbackPrompt(normalizedPrompt, {
				listFiles: listFilesBlocks,
				shellExec: shellExecBlocks,
			});

			currentExecutionState = appendToolFeedbackMessages(currentExecutionState);
			setState({
				...getState(),
				workspaceExecution: currentExecutionState,
				statusMessage: `ツール結果を反映して続行します（${turn + 2}/${MAX_TOOL_TURNS}）。`,
			});

			await broadcastMessage({
				type: 'workspace-execution-state',
				state: currentExecutionState,
			});
		}

		if (!lastResult) {
			throw new Error('Agent の応答がありません。');
		}

		const response = buildAgentResponseText(
			lastResult,
			accumulatedEdits,
			accumulatedFileReads,
			accumulatedListFiles,
			accumulatedShellExec,
		);
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

async function applyAgentToolListFiles(result: AgentResult): Promise<AgentOrchestratorListFilesBlock[]> {
	const workspaceContext = collectWorkspaceContext();
	const items = getListFilesOutputs(result);
	if (!workspaceContext.workspacePath.trim() || items.length === 0) {
		return [];
	}

	const blocks: AgentOrchestratorListFilesBlock[] = [];

	for (const item of items) {
		const pattern = item.pattern?.trim() || '**/*';
		try {
			const listed = await agentToolListFiles({
				workspaceRoot: workspaceContext.workspacePath,
				pattern: item.pattern,
				maxDepth: item.maxDepth,
			});
			blocks.push({
				pattern: listed.pattern,
				files: listed.files,
				truncated: listed.truncated,
				totalCount: listed.totalCount,
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			blocks.push({
				pattern,
				files: [],
				truncated: false,
				totalCount: 0,
				errorMessage,
			});
		}
	}

	return blocks;
}

async function applyAgentToolShellExec(result: AgentResult): Promise<AgentOrchestratorShellExecBlock[]> {
	const workspaceContext = collectWorkspaceContext();
	const items = getShellExecOutputs(result);
	if (!workspaceContext.workspacePath.trim() || items.length === 0) {
		return [];
	}

	const blocks: AgentOrchestratorShellExecBlock[] = [];

	for (const item of items) {
		try {
			const exec = await agentToolShellExec({
				workspaceRoot: workspaceContext.workspacePath,
				command: item.command,
				cwd: item.cwd,
			});
			blocks.push({
				command: exec.command,
				cwd: exec.cwd,
				stdout: exec.stdout,
				stderr: exec.stderr,
				exitCode: exec.exitCode,
				timedOut: exec.timedOut,
				truncated: exec.truncated,
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			blocks.push({
				command: item.command,
				cwd: workspaceContext.workspacePath,
				stdout: '',
				stderr: '',
				exitCode: null,
				timedOut: false,
				truncated: false,
				errorMessage,
			});
		}
	}

	return blocks;
}

async function applyAgentToolFileReads(
	result: AgentResult,
): Promise<Array<{ relativePath: string; content: string }>> {
	const workspaceContext = collectWorkspaceContext();
	const fileReads = getFileReadOutputs(result);
	if (!workspaceContext.workspacePath.trim() || fileReads.length === 0) {
		return [];
	}

	const blocks: Array<{ relativePath: string; content: string }> = [];

	for (const fileRead of fileReads) {
		const rawPath = fileRead.filePath.trim();
		try {
			const read = await agentToolFileRead({
				workspaceRoot: workspaceContext.workspacePath,
				filePath: rawPath,
			});
			blocks.push({ relativePath: read.relativePath, content: read.content });
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			blocks.push({
				relativePath: rawPath || '(不明)',
				content: `[読み取りエラー: ${errorMessage}]`,
			});
		}
	}

	return blocks;
}

async function applyAgentToolFileEdits(access: OrchestrationAccess, result: AgentResult) {
	const workspaceContext = collectWorkspaceContext();
	const fileEdits = getFileEditOutputs(result);
	if (!workspaceContext.workspacePath.trim() || fileEdits.length === 0) {
		return [];
	}

	const { getState, setState, broadcastMessage } = access;
	const appliedEdits: Array<{ relativePath: string; absolutePath: string }> = [];

	for (const fileEdit of fileEdits) {
		const normalizedRelativePath = fileEdit.relativePath.trim();
		const savingState = createSavingAgentToolFileEditState({
			workspaceRoot: workspaceContext.workspacePath,
			relativePath: normalizedRelativePath,
			content: fileEdit.content,
		});

		setState({
			...getState(),
			agentToolFileEdit: savingState,
			statusMessage: `ファイルを保存しています: ${normalizedRelativePath}`,
			errorMessage: undefined,
		});

		await broadcastMessage({
			type: 'agent-tool-file-edit-state',
			state: savingState,
		});

		let applied: { relativePath: string; absolutePath: string };
		try {
			applied = await agentToolFileEditWrite({
				workspaceRoot: workspaceContext.workspacePath,
				relativePath: normalizedRelativePath,
				content: fileEdit.content,
			});
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : String(error);
			const errorState = createErrorAgentToolFileEditState({
				workspaceRoot: workspaceContext.workspacePath,
				relativePath: normalizedRelativePath,
				content: fileEdit.content,
				errorMessage,
			});

			setState({
				...getState(),
				agentToolFileEdit: errorState,
				statusMessage: 'ファイルの保存に失敗しました。',
				errorMessage,
			});

			await broadcastMessage({
				type: 'agent-tool-file-edit-state',
				state: errorState,
			});

			throw error;
		}

		const successState = createSuccessAgentToolFileEditState({
			workspaceRoot: workspaceContext.workspacePath,
			relativePath: applied.relativePath,
			content: fileEdit.content,
			resultPath: applied.absolutePath,
		});

		setState({
			...getState(),
			agentToolFileEdit: successState,
			statusMessage: `ファイルを保存しました: ${applied.relativePath}`,
			errorMessage: undefined,
		});

		await broadcastMessage({
			type: 'agent-tool-file-edit-state',
			state: successState,
		});

		appliedEdits.push(applied);
	}

	return appliedEdits;
}

export async function runAgentToolFileEdit(access: OrchestrationAccess, relativePath: string, content: string) {
	const workspaceContext = collectWorkspaceContext();
	const normalizedRelativePath = relativePath.trim();
	const normalizedContent = content;
	const { getState, setState, broadcastMessage } = access;
	const savingState = createSavingAgentToolFileEditState({
		workspaceRoot: workspaceContext.workspacePath,
		relativePath: normalizedRelativePath,
		content: normalizedContent,
	});

	setState({
		...getState(),
		agentToolFileEdit: savingState,
		statusMessage: 'ファイルを保存しています。',
		errorMessage: undefined,
	});

	await broadcastMessage({
		type: 'agent-tool-file-edit-state',
		state: savingState,
	});

	try {
		const result = await agentToolFileEditWrite({
			workspaceRoot: workspaceContext.workspacePath,
			relativePath: normalizedRelativePath,
			content: normalizedContent,
		});
		const successState = createSuccessAgentToolFileEditState({
			workspaceRoot: workspaceContext.workspacePath,
			relativePath: normalizedRelativePath,
			content: normalizedContent,
			resultPath: result.absolutePath,
		});

		setState({
			...getState(),
			agentToolFileEdit: successState,
			statusMessage: `ファイルを保存しました: ${result.relativePath}`,
			errorMessage: undefined,
		});

		await broadcastMessage({
			type: 'agent-tool-file-edit-state',
			state: successState,
		});
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		const errorState = createErrorAgentToolFileEditState({
			workspaceRoot: workspaceContext.workspacePath,
			relativePath: normalizedRelativePath,
			content: normalizedContent,
			errorMessage,
		});

		setState({
			...getState(),
			agentToolFileEdit: errorState,
			statusMessage: 'ファイルの保存に失敗しました。',
			errorMessage,
		});

		await broadcastMessage({
			type: 'agent-tool-file-edit-state',
			state: errorState,
		});
	}
}
