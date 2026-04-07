import type { WorkspaceExecutionState } from '../../../core/index';
import { fieldClass } from '../consts';
import type { ExtensionState } from '../types';

type WorkspaceViewProps = {
	bootstrapState: ExtensionState;
	setting: {
		selectedProviderId: string;
		selectedModelId: string;
		providers: { id: string; name: string }[];
		models: { id: string; providerId: string; name: string; enabled: boolean }[];
	};
	workspaceExecution: WorkspaceExecutionState;
	workspaceFileEdit: ExtensionState['workspaceFileEdit'];
	configurationIssues: string[];
	prompt: string;
	fileEditRelativePath: string;
	fileEditContent: string;
	syncStatus: 'idle' | 'saving' | 'saved' | 'error';
	syncMessage: string;
	onPromptInput: (value: string) => void;
	onSelectModel: (modelId: string) => void;
	onRunAgent: () => void;
	onRetryAgent: () => void;
	onFileEditRelativePathInput: (value: string) => void;
	onFileEditContentInput: (value: string) => void;
	onSubmitFileEdit: () => void;
	onOpenSettings: () => void;
};

function buttonClass(disabled?: boolean) {
	return [
		'inline-flex items-center justify-center rounded-full border px-4 py-2 text-sm font-semibold transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]',
		'border-[color:var(--vscode-panel-border)] hover:border-[color:var(--vscode-focusBorder)]',
		disabled ? 'cursor-not-allowed opacity-50' : '',
	]
		.filter(Boolean)
		.join(' ');
}

function iconButtonClass(disabled?: boolean) {
	return [
		'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border text-base font-semibold transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]',
		'border-[color:var(--vscode-panel-border)] hover:border-[color:var(--vscode-focusBorder)]',
		disabled ? 'cursor-not-allowed opacity-50' : '',
	]
		.filter(Boolean)
		.join(' ');
}

function syncToneClass(syncStatus: WorkspaceViewProps['syncStatus']) {
	switch (syncStatus) {
		case 'saving':
			return 'text-[color:var(--vscode-descriptionForeground)]';
		case 'saved':
			return 'text-[color:var(--vscode-terminal-ansiGreen)]';
		case 'error':
			return 'text-[color:var(--vscode-errorForeground)]';
		default:
			return 'text-[color:var(--vscode-descriptionForeground)]';
	}
}

export function WorkspaceView({
	bootstrapState,
	setting,
	workspaceExecution,
	workspaceFileEdit,
	configurationIssues,
	prompt,
	fileEditRelativePath,
	fileEditContent,
	syncStatus,
	syncMessage,
	onPromptInput,
	onSelectModel,
	onRunAgent,
	onRetryAgent,
	onFileEditRelativePathInput,
	onFileEditContentInput,
	onSubmitFileEdit,
	onOpenSettings,
}: WorkspaceViewProps) {
	const trimmedPrompt = prompt.trim();
	const canSubmit = trimmedPrompt.length > 0 && workspaceExecution.status !== 'running';
	const canRetry = workspaceExecution.canRetry && workspaceExecution.prompt.trim().length > 0;
	const trimmedFileEditRelativePath = fileEditRelativePath.trim();
	const canSaveFile = trimmedFileEditRelativePath.length > 0 && workspaceFileEdit.status !== 'saving';
	const availableModels = setting.models.filter((model) => model.enabled);
	const selectedProviderName = setting.providers.find((provider) => provider.id === setting.selectedProviderId)?.name ?? '未選択';
	const selectedModelName = setting.models.find((model) => model.id === setting.selectedModelId)?.name ?? '未選択';

	return (
		<section class="grid min-w-0 gap-4">
			<header class="flex flex-wrap items-start justify-between gap-3">
				<h2 class="m-0 text-lg font-bold">チャット</h2>
				<button class={buttonClass()} type="button" onClick={onOpenSettings}>
					設定
				</button>
			</header>

			{configurationIssues.length > 0 ? (
				<p class="m-0 text-sm text-[color:var(--vscode-descriptionForeground)]">{configurationIssues[0]}</p>
			) : null}

			<section class="grid min-w-0 gap-3 rounded-2xl border border-[color:var(--vscode-panel-border)] p-4">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="grid gap-1">
						<p class="m-0 text-sm font-semibold text-[color:var(--vscode-foreground)]">会話ログ</p>
						<p class="m-0 text-sm text-[color:var(--vscode-descriptionForeground)]">
							送信した指示と応答が、下へ積み上がるチャット形式で表示されます。
						</p>
					</div>
					<button class={buttonClass(!canRetry)} type="button" onClick={onRetryAgent} disabled={!canRetry}>
						再試行
					</button>
				</div>

				<div class="flex min-h-[22rem] w-full min-w-0 flex-col gap-3 overflow-y-auto pr-1">
					{workspaceExecution.messages.length === 0 ? (
						<p class="m-0 text-sm text-[color:var(--vscode-descriptionForeground)]">まだ応答はありません。</p>
					) : (
						workspaceExecution.messages.map((message) => renderWorkspaceMessage(message))
					)}
				</div>
			</section>

			<form
				class="grid min-w-0 gap-3 rounded-[28px] border border-[color:var(--vscode-panel-border)] p-3.5"
				onSubmit={(event) => {
					event.preventDefault();
					if (canSubmit) {
						onRunAgent();
					}
				}}
			>
				<label class="grid min-w-0 gap-2">
					<span class="sr-only">AI への指示</span>
					<textarea
						class={`${fieldClass} min-h-[112px] resize-none rounded-[22px] border-0 px-4 py-3 text-[color:var(--vscode-foreground)]`}
						rows={4}
						value={prompt}
						onInput={(event) => onPromptInput((event.currentTarget as HTMLTextAreaElement).value)}
						placeholder="Plan, @ for context, / for commands"
					/>
				</label>

				<div class="flex flex-wrap items-center justify-between gap-2">
					<div class="flex min-w-0 flex-wrap items-center gap-2">
						<label class="grid min-w-0">
							<span class="sr-only">Model</span>
							<select
								class="min-w-[10rem] rounded-full border border-[color:var(--vscode-panel-border)] bg-transparent px-3 py-2 text-sm text-[color:var(--vscode-foreground)] outline-none"
								value={setting.selectedModelId}
								onChange={(event) => onSelectModel((event.currentTarget as HTMLSelectElement).value)}
								aria-label="Model を選択"
							>
								{availableModels.length === 0 ? <option value="">Model を追加してください</option> : null}
								{availableModels.map((model) => {
									const providerName = setting.providers.find((provider) => provider.id === model.providerId)?.name ?? 'Provider 未選択';
									return (
										<option key={model.id} value={model.id}>
											{model.name} · {providerName}
										</option>
									);
								})}
							</select>
						</label>
					</div>

					<div class="flex items-center gap-2">
						<button
							class={iconButtonClass(!canRetry)}
							type="button"
							onClick={onRetryAgent}
							disabled={!canRetry}
							title="再試行"
							aria-label="再試行"
						>
							↻
						</button>
						<button
							class={iconButtonClass(!canSubmit)}
							type="submit"
							disabled={!canSubmit}
							title="送信"
							aria-label="送信"
						>
							↑
						</button>
					</div>
				</div>
			</form>
		</section>
	);
}

function renderWorkspaceMessage(message: WorkspaceExecutionState['messages'][number]) {
	const isUser = message.role === 'user';
	const isAssistant = message.role === 'assistant';
	const isError = message.role === 'error';
	const isStreaming = message.status === 'streaming';
	const content = message.content.trim().length > 0 ? message.content : isStreaming ? '応答を生成しています。' : '';

	return (
		<article
			key={message.id}
			class={`grid min-w-0 max-w-[92%] gap-1 rounded-2xl border px-4 py-3 ${
				isError
					? 'self-start border-[color:var(--vscode-errorForeground)]'
					: isUser
						? 'self-end border-[color:var(--vscode-focusBorder)]'
						: 'self-start border-[color:var(--vscode-panel-border)]'
			}`}
		>
			<div class="flex flex-wrap items-center justify-between gap-2">
				<p class="m-0 text-xs font-semibold uppercase tracking-[0.12em] text-[color:var(--vscode-descriptionForeground)]">
					{message.title}
				</p>
				<p class="m-0 text-xs text-[color:var(--vscode-descriptionForeground)]">
					{new Date(message.timestamp).toLocaleTimeString('ja-JP')}
				</p>
			</div>
			<p
				class={`m-0 whitespace-pre-wrap break-words leading-7 ${
					isError
						? 'text-[color:var(--vscode-errorForeground)]'
						: isAssistant
							? 'text-[color:var(--vscode-foreground)]'
							: 'text-[color:var(--vscode-foreground)]'
				}`}
			>
				{content}
			</p>
			{isStreaming ? <p class="m-0 text-sm text-[color:var(--vscode-descriptionForeground)]">生成中です。</p> : null}
		</article>
	);
}
