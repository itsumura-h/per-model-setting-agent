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
	bootstrapState,
	setting,
	providerModels,
	runResult,
	settingSummary,
	configurationIssues,
	prompt,
	syncStatus,
	syncMessage,
	onPromptInput,
	onSelectProvider,
	onSelectModel,
	onRunPreview,
	onOpenSettings,
}: WorkspaceViewProps) {
	return (
		<>
			<header class="flex flex-wrap items-start justify-between gap-4">
				<div class="min-w-0">
					<p class="m-0 mb-2 text-xs font-bold uppercase tracking-[0.16em]">Per Model Setting Agent</p>
					<h1>設定メニュー付きのメインパネル</h1>
					<p class="m-0 mt-2 max-w-[72ch]">
						Provider / Model の選択と CRUD を同じ画面で扱い、`~/.permosa/setting.json` に保存します。
					</p>
				</div>

				<div class="ml-auto flex flex-wrap items-center gap-3">
					<div class="grid justify-items-end gap-1">
						<span class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] border-[color:var(--vscode-panel-border)]">{syncStatus}</span>
						<span class="text-sm">{syncMessage}</span>
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
			</header>

			<section
				class={`grid gap-2 px-4 py-3 rounded-2xl border ${
					bootstrapState.loadMode === 'loaded'
						? 'border-[color:var(--vscode-terminal-ansiGreen)]'
						: bootstrapState.loadMode === 'corrupt'
							? 'border-[color:var(--vscode-errorForeground)]'
							: 'border-[color:var(--vscode-panel-border)]'
				}`}
			>
				<div>
					<p class="text-xs font-bold uppercase tracking-[0.12em]">設定ファイル</p>
					<p class="m-0">{bootstrapState.message}</p>
				</div>
				<div class="flex flex-wrap gap-3 text-sm">
					<span>{bootstrapState.filePath}</span>
					{bootstrapState.lastSavedAt ? <span>最終保存: {bootstrapState.lastSavedAt}</span> : null}
				</div>
				{bootstrapState.errorMessage ? <pre class="m-0 whitespace-pre-wrap">{bootstrapState.errorMessage}</pre> : null}
			</section>

			<section class="grid min-w-0 items-start gap-4 grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.9fr)]">
				<section class="grid min-w-0 gap-4 p-4 rounded-2xl border border-[color:var(--vscode-panel-border)]">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div>
							<h2>実行プレビュー</h2>
							<p>現在の Provider / Model を使って、実行前の状態を確認します。</p>
						</div>
						<button class="btn btn-ghost btn-sm font-semibold border border-[color:var(--vscode-panel-border)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]" type="button" onClick={onOpenSettings}>
							設定を開く
						</button>
					</div>

					<div class="grid min-w-0 gap-3 grid-cols-1 md:grid-cols-2">
						<label class="grid min-w-0 gap-2">
							<span>Provider</span>
							<select value={setting.selectedProviderId} onChange={(event) => onSelectProvider((event.currentTarget as HTMLSelectElement).value)}>
								{setting.providers.length === 0 ? <option value="">Provider を追加してください</option> : null}
								{setting.providers.map((provider) => (
									<option key={provider.id} value={provider.id}>
										{provider.name}
									</option>
								))}
							</select>
						</label>

						<label class="grid min-w-0 gap-2">
							<span>Model</span>
							<select value={setting.selectedModelId} onChange={(event) => onSelectModel((event.currentTarget as HTMLSelectElement).value)}>
								{providerModels.length === 0 ? <option value="">Model を追加してください</option> : null}
								{providerModels.map((model) => (
									<option key={model.id} value={model.id}>
										{model.name}
									</option>
								))}
							</select>
						</label>
					</div>

					<label class="grid min-w-0 gap-2">
						<span>確認メッセージ</span>
						<textarea
							rows={5}
							value={prompt}
							onInput={(event) => onPromptInput((event.currentTarget as HTMLTextAreaElement).value)}
							placeholder="設定内容を確認したいメッセージを入力"
						/>
					</label>

					<div class="flex flex-wrap items-center gap-2.5">
						<button class="btn btn-ghost btn-sm font-bold border border-[color:var(--vscode-focusBorder)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]" type="button" onClick={onRunPreview}>
							実行
						</button>
						<button class="btn btn-ghost btn-sm font-semibold border border-[color:var(--vscode-panel-border)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]" type="button" onClick={onRunPreview}>
							再試行
						</button>
					</div>
				</section>

				<section class="grid min-w-0 gap-4 p-4 rounded-2xl border border-[color:var(--vscode-panel-border)] content-start">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div>
							<h2>結果</h2>
							<p>設定不備がある場合は、ここにガイダンスを表示します。</p>
						</div>
					</div>

					<div class="grid min-w-0 gap-3.5">
						<div class="flex flex-wrap items-center justify-between gap-2.5">
							<h3>{runResult.title}</h3>
							<span class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] border-[color:var(--vscode-panel-border)]">
								{runResult.statusLabel}
							</span>
						</div>
						<p class="m-0 leading-7">{runResult.response}</p>
						<div class="grid gap-1 text-sm">
							<span>{runResult.providerName}</span>
							<span>{runResult.modelName}</span>
							<span>{runResult.baseUrl}</span>
							<span>{runResult.timestamp}</span>
						</div>
						<div class="grid min-w-0 gap-2.5 p-3.5 rounded-2xl border border-[color:var(--vscode-panel-border)]">
							<span class="text-xs font-bold uppercase tracking-[0.12em]">Prompt</span>
							<pre>{runResult.prompt}</pre>
						</div>
						<div class="grid min-w-0 gap-2.5 p-3.5 rounded-2xl border border-[color:var(--vscode-panel-border)]">
							<span class="text-xs font-bold uppercase tracking-[0.12em]">Checklist</span>
							<ul class="m-0 grid gap-2 pl-4">
								{runResult.checklist.map((item) => (
									<li key={item}>{item}</li>
								))}
							</ul>
						</div>
						{runResult.errorMessage ? (
							<div class="grid min-w-0 gap-2.5 p-3.5 rounded-2xl border border-[color:var(--vscode-panel-border)]">
								<span class="text-xs font-bold uppercase tracking-[0.12em]">Error</span>
								<pre>{runResult.errorMessage}</pre>
							</div>
						) : null}
					</div>

					<div class="grid min-w-0 gap-2.5 p-3.5 rounded-2xl border border-[color:var(--vscode-panel-border)]">
						<span class="text-xs font-bold uppercase tracking-[0.12em]">Configuration</span>
						<ul class="m-0 grid gap-2 pl-4">
							{settingSummary.map((item) => (
								<li key={item}>{item}</li>
							))}
						</ul>
					</div>

					{configurationIssues.length > 0 ? (
						<div class="grid min-w-0 gap-2.5 p-3.5 rounded-2xl border border-[color:var(--vscode-panel-border)]">
							<span class="text-xs font-bold uppercase tracking-[0.12em]">Guidance</span>
							<ul class="m-0 grid gap-2 pl-4">
								{configurationIssues.map((item) => (
									<li key={item}>{item}</li>
								))}
							</ul>
						</div>
					) : null}
				</section>
			</section>
		</>
	);
}
