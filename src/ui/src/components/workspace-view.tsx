import type { ModelConfig, ProviderConfig } from '../../../core/index';
import type { ExtensionState, RunPreview } from '../types';

type WorkspaceViewProps = {
	bootstrapState: ExtensionState;
	setting: {
		selectedProviderId: string;
		selectedModelId: string;
		providers: ProviderConfig[];
	};
	providerModels: ModelConfig[];
	runResult: RunPreview;
	settingSummary: string[];
	configurationIssues: string[];
	prompt: string;
	syncStatus: 'idle' | 'saving' | 'saved' | 'error';
	syncMessage: string;
	onPromptInput: (value: string) => void;
	onSelectProvider: (providerId: string) => void;
	onSelectModel: (modelId: string) => void;
	onRunPreview: () => void;
	onOpenSettings: () => void;
};

export function WorkspaceView({
	setting,
	providerModels,
	runResult,
	prompt,
	onPromptInput,
	onSelectModel,
	onRunPreview,
	onOpenSettings,
}: WorkspaceViewProps) {
	return (
		<section class="grid min-w-0 gap-4">
			<section class="grid min-w-0 gap-4 rounded-2xl border border-[color:var(--vscode-panel-border)] p-4">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div class="grid min-w-0 gap-2">
						<h2>Agent</h2>
					</div>
					<button
						class="btn btn-circle btn-ghost h-11 w-11 p-0 text-lg border border-[color:var(--vscode-panel-border)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]"
						type="button"
						onClick={onOpenSettings}
						aria-label="設定を新しいタブで開く"
					>
						⚙
					</button>
				</div>

				<div class="grid min-w-0 gap-3">
					<label class="grid min-w-0 gap-2">
						<span>Model</span>
						<select value={setting.selectedModelId} onChange={(event) => onSelectModel((event.currentTarget as HTMLSelectElement).value)}>
							{providerModels.length === 0 ? <option value="">有効な Model を追加してください</option> : null}
							{providerModels.map((model) => (
								<option key={model.id} value={model.id}>
									{model.name}
								</option>
							))}
						</select>
					</label>

					<div class="grid min-w-0 gap-2">
						<span>対話</span>
						<div class="grid min-h-[280px] min-w-0 gap-3 overflow-y-auto rounded-2xl border border-[color:var(--vscode-panel-border)] p-4">
							<div class="grid gap-2">
								<span class="text-xs font-bold uppercase tracking-[0.12em]">Assistant</span>
								<p class="m-0 whitespace-pre-wrap break-words leading-7">
									{runResult.response || 'まだ応答はありません。'}
								</p>
							</div>
							{runResult.errorMessage ? (
								<div class="grid gap-2">
									<span class="text-xs font-bold uppercase tracking-[0.12em]">Error</span>
									<p class="m-0 whitespace-pre-wrap break-words leading-7">{runResult.errorMessage}</p>
								</div>
							) : null}
						</div>
					</div>

					<label class="grid min-w-0 gap-2">
						<span>メッセージ</span>
						<textarea
							rows={6}
							value={prompt}
							onInput={(event) => onPromptInput((event.currentTarget as HTMLTextAreaElement).value)}
							placeholder="エージェントに送るメッセージを入力"
						/>
					</label>

					<div class="flex justify-end">
						<button class="btn btn-ghost btn-sm font-bold border border-[color:var(--vscode-focusBorder)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]" type="button" onClick={onRunPreview}>
							送信
						</button>
					</div>
				</div>
			</section>
		</section>
	);
}
