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
	const canRetry = workspaceExecution.canRetry && trimmedPrompt.length > 0;
	const trimmedFileEditRelativePath = fileEditRelativePath.trim();
	const canSaveFile = trimmedFileEditRelativePath.length > 0 && workspaceFileEdit.status !== 'saving';
	const availableModels = setting.models.filter((model) => model.enabled);

	return (
		<section class="grid min-w-0 gap-4">
			<header class="flex flex-wrap items-start justify-between gap-3">
				<div class="grid min-w-0 gap-1">
					<h2 class="m-0">Workspace</h2>
					<p class="m-0 text-sm text-[color:var(--vscode-descriptionForeground)]">{bootstrapState.message}</p>
				</div>
				<button class={buttonClass()} type="button" onClick={onOpenSettings}>
					設定
				</button>
			</header>
			<p class={`m-0 text-sm ${syncToneClass(syncStatus)}`}>{syncMessage}</p>

			<section class="grid min-w-0 gap-3 rounded-2xl border border-[color:var(--vscode-panel-border)] p-4">
				<div class="grid min-w-0 gap-3 rounded-[20px] border border-[color:var(--vscode-panel-border)] p-4">
					<label class="grid min-w-0 gap-2">
						<span class="text-sm text-[color:var(--vscode-descriptionForeground)]">Model</span>
						<select
							class="w-full min-w-0 rounded-[14px] border border-[color:var(--vscode-panel-border)] bg-transparent px-3 py-2 text-[color:var(--vscode-foreground)] outline-none"
							value={setting.selectedModelId}
							onChange={(event) => onSelectModel((event.currentTarget as HTMLSelectElement).value)}
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

					<textarea
						class={`${fieldClass} min-h-[150px] resize-none`}
						rows={6}
						value={prompt}
						onInput={(event) => onPromptInput((event.currentTarget as HTMLTextAreaElement).value)}
						placeholder="Plan, @ for context, / for commands"
					/>

							<div class="flex flex-wrap items-center justify-between gap-3">
								<div class="flex flex-wrap items-center gap-2">
									<button class={buttonClass(!canRetry)} type="button" onClick={onRetryAgent} disabled={!canRetry}>
										再試行
									</button>
							<button class={buttonClass(!canSubmit)} type="button" onClick={onRunAgent} disabled={!canSubmit}>
								送信
							</button>
						</div>
						<div class="flex items-center gap-2 text-xs text-[color:var(--vscode-descriptionForeground)]">
							<span>{workspaceExecution.timestamp ? new Date(workspaceExecution.timestamp).toLocaleTimeString('ja-JP') : ''}</span>
						</div>
					</div>
					<div class="grid gap-2">
						<p class="m-0 text-sm text-[color:var(--vscode-descriptionForeground)]">
							{workspaceExecution.status === 'running'
								? 'Agent が応答を生成しています。'
								: workspaceExecution.status === 'error'
									? '失敗理由を確認して再試行できます。'
									: workspaceExecution.status === 'success'
										? '最新の応答を下に表示しています。'
										: '送信すると extension host 側で実行されます。'}
						</p>

							<div class="grid min-w-0 gap-2 rounded-[20px] border border-[color:var(--vscode-panel-border)] p-4">
								<p class="m-0 text-sm font-semibold text-[color:var(--vscode-foreground)]">
									{workspaceExecution.fileEditSafetyNotice.title}
								</p>
							<ul class="m-0 grid gap-1.5 pl-5 text-sm leading-6 text-[color:var(--vscode-descriptionForeground)]">
								{workspaceExecution.fileEditSafetyNotice.items.map((item) => (
									<li key={item}>{item}</li>
								))}
							</ul>
						</div>

						<div class="grid min-w-0 gap-3 rounded-[20px] border border-[color:var(--vscode-panel-border)] p-4">
							{configurationIssues.length > 0 ? (
								<p class="m-0 text-sm text-[color:var(--vscode-descriptionForeground)]">
									{configurationIssues[0]}
								</p>
							) : null}

							<p class="m-0 whitespace-pre-wrap break-words leading-7 text-[color:var(--vscode-foreground)]">
								{workspaceExecution.response}
							</p>

							{workspaceExecution.errorMessage ? (
								<p class="m-0 whitespace-pre-wrap break-words leading-7 text-[color:var(--vscode-errorForeground)]">
									{workspaceExecution.errorMessage}
								</p>
							) : null}
						</div>

						<div class="grid min-w-0 gap-3 rounded-[20px] border border-[color:var(--vscode-panel-border)] p-4">
							<div class="grid gap-1">
								<p class="m-0 text-sm font-semibold text-[color:var(--vscode-foreground)]">ファイル編集</p>
								<p class="m-0 text-sm text-[color:var(--vscode-descriptionForeground)]">
									対象ファイル、差分方針、失敗時の戻し方を先に確認してから保存します。
								</p>
							</div>

							<div class="grid gap-1.5 text-sm text-[color:var(--vscode-descriptionForeground)]">
								<p class="m-0">対象: {trimmedFileEditRelativePath || '未入力'}</p>
								<p class="m-0">差分方針: 最小差分を基本に必要な変更だけを適用</p>
								<p class="m-0">戻し方: 元ファイルを復元するか、差分を取り消してください</p>
							</div>

							{workspaceFileEdit.status === 'saving' ? (
								<p class="m-0 text-sm text-[color:var(--vscode-descriptionForeground)]">ファイルを書き込んでいます。</p>
							) : null}
							{workspaceFileEdit.status === 'success' ? (
								<p class="m-0 text-sm text-[color:var(--vscode-terminal-ansiGreen)]">
									{workspaceFileEdit.resultPath ? `保存しました: ${workspaceFileEdit.resultPath}` : 'ファイルを保存しました。'}
								</p>
							) : null}
							{workspaceFileEdit.status === 'error' && workspaceFileEdit.errorMessage ? (
								<p class="m-0 whitespace-pre-wrap break-words text-sm text-[color:var(--vscode-errorForeground)]">
									{workspaceFileEdit.errorMessage}
								</p>
							) : null}

							<label class="grid min-w-0 gap-2">
								<span class="text-sm text-[color:var(--vscode-descriptionForeground)]">Relative path</span>
								<input
									class={fieldClass}
									value={fileEditRelativePath}
									onInput={(event) => onFileEditRelativePathInput((event.currentTarget as HTMLInputElement).value)}
									placeholder="src/example.ts"
								/>
							</label>

							<label class="grid min-w-0 gap-2">
								<span class="text-sm text-[color:var(--vscode-descriptionForeground)]">Content</span>
								<textarea
									class={`${fieldClass} min-h-[180px] resize-y`}
									rows={8}
									value={fileEditContent}
									onInput={(event) => onFileEditContentInput((event.currentTarget as HTMLTextAreaElement).value)}
									placeholder="編集したいファイルの内容を入力してください"
								/>
							</label>

							<div class="flex flex-wrap items-center gap-2">
								<button class={buttonClass(!canSaveFile)} type="button" onClick={onSubmitFileEdit} disabled={!canSaveFile}>
									保存
								</button>
								<span class="text-xs text-[color:var(--vscode-descriptionForeground)]">
									保存前に対象ファイルと戻し方を確認できます。
								</span>
							</div>
						</div>
					</div>
				</div>
			</section>
		</section>
	);
}
