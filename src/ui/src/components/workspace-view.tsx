import type { AgentToolFileEditState, WorkspaceExecutionState } from '../../../core/index';
import { fieldClass } from '../consts';

type WorkspaceViewProps = {
	settings: {
		selectedProviderId: string;
		selectedModelId: string;
		providers: { id: string; name: string }[];
		models: { id: string; providerId: string; name: string; enabled: boolean }[];
	};
	workspaceExecution: WorkspaceExecutionState;
	agentToolFileEdit: AgentToolFileEditState;
	configurationIssues: string[];
	prompt: string;
	fileEditRelativePath: string;
	fileEditContent: string;
	onPromptInput: (value: string) => void;
	onSelectModel: (modelId: string) => void;
	onRunAgent: () => void;
	onFileEditRelativePathInput: (value: string) => void;
	onFileEditContentInput: (value: string) => void;
	onSubmitFileEdit: () => void;
	onOpenSettings: () => void;
};

function iconButtonClass(disabled?: boolean) {
	return [
		'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition-transform hover:-translate-y-px focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]',
		'border-[color:var(--vscode-panel-border)] hover:border-[color:var(--vscode-focusBorder)]',
		disabled ? 'cursor-not-allowed opacity-50' : '',
	]
		.filter(Boolean)
		.join(' ');
}

function GearIcon() {
	return (
		<svg
			class="h-3.5 w-3.5 shrink-0 text-[color:var(--vscode-foreground)]"
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="currentColor"
			aria-hidden="true"
		>
			<path d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.488.488 0 0 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.07.64-.07.94s.02.63.06.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
		</svg>
	);
}

export function WorkspaceView({
	settings,
	workspaceExecution,
	agentToolFileEdit,
	configurationIssues,
	prompt,
	fileEditRelativePath,
	fileEditContent,
	onPromptInput,
	onSelectModel,
	onRunAgent,
	onFileEditRelativePathInput,
	onFileEditContentInput,
	onSubmitFileEdit,
	onOpenSettings,
}: WorkspaceViewProps) {
	const trimmedPrompt = prompt.trim();
	const canSubmit = trimmedPrompt.length > 0 && workspaceExecution.status !== 'running';
	const trimmedFileEditRelativePath = fileEditRelativePath.trim();
	const canSaveFile = trimmedFileEditRelativePath.length > 0 && agentToolFileEdit.status !== 'saving';
	const availableModels = settings.models.filter((model) => model.enabled);

	return (
		<section class="grid min-w-0 gap-4">
			{configurationIssues.length > 0 ? (
				<p class="m-0 text-sm text-[color:var(--vscode-descriptionForeground)]">{configurationIssues[0]}</p>
			) : null}

			<section class="grid min-w-0 gap-2 rounded-2xl">
				<div class="flex min-h-[22rem] w-full min-w-0 flex-col gap-1.5 overflow-y-auto pr-1">
					{workspaceExecution.messages.map((message) => renderWorkspaceMessage(message))}
				</div>
			</section>

			<form
				class="grid min-w-0 gap-2 rounded-[24px] border border-[color:var(--vscode-panel-border)] p-2.5"
				onSubmit={(event) => {
					event.preventDefault();
					if (canSubmit) {
						onRunAgent();
					}
				}}
			>
				<label class="grid min-w-0 gap-1.5">
					<span class="sr-only">AI への指示</span>
					<textarea
						class={`${fieldClass} min-h-[96px] resize-none rounded-[18px] border-0 px-3 py-2 text-[color:var(--vscode-foreground)]`}
						rows={4}
						value={prompt}
						onInput={(event) => onPromptInput((event.currentTarget as HTMLTextAreaElement).value)}
						placeholder=""
					/>
				</label>

				<div class="flex flex-wrap items-center justify-between gap-1.5">
					<div class="flex min-w-0 flex-wrap items-center gap-1.5">
						<label class="grid min-w-0">
							<span class="sr-only">Model</span>
							<select
								class="min-w-[9rem] rounded-md border border-base-300 bg-base-200 px-2.5 py-1.5 text-xs text-base-content outline-none"
								value={settings.selectedModelId}
								onChange={(event) => onSelectModel((event.currentTarget as HTMLSelectElement).value)}
								aria-label="Model を選択"
							>
								{availableModels.length === 0 ? (
									<option class="bg-base-200 text-base-content" value="">
										Model を追加してください
									</option>
								) : null}
								{availableModels.map((model) => {
									return (
										<option class="bg-base-200 text-base-content" key={model.id} value={model.id}>
											{model.name}
										</option>
									)
								})}
							</select>
						</label>
					</div>

					<div class="flex items-center gap-1.5">
						<button
							class={iconButtonClass(!canSubmit)}
							type="submit"
							disabled={!canSubmit}
							title="送信"
							aria-label="送信"
						>
							↑
						</button>
						<button
							class={iconButtonClass(false)}
							type="button"
							onClick={onOpenSettings}
							title="設定"
							aria-label="設定"
						>
							<GearIcon />
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

	const articleClass =
		isUser
			? 'grid min-w-0 max-w-[92%] self-end gap-0.5 rounded-2xl border border-[color:var(--vscode-focusBorder)] px-3 py-2'
			: 'grid w-full min-w-0 gap-0.5 border-0 px-0 py-1.5';

	return (
		<article key={message.id} class={articleClass}>
			<p
				class={`m-0 whitespace-pre-wrap break-words text-sm leading-snug ${
					isError
						? 'text-[color:var(--vscode-errorForeground)]'
						: isAssistant
							? 'text-[color:var(--vscode-foreground)]'
							: 'text-[color:var(--vscode-foreground)]'
				}`}
			>
				{content}
			</p>
			{isStreaming ? <p class="m-0 text-xs text-[color:var(--vscode-descriptionForeground)] leading-tight">生成中です。</p> : null}
		</article>
	);
}
