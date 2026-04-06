import { providerPresets } from '../../../core/index';
import type { ProviderSettingsPageProps } from './types';

export function ProviderSettingsPage({
	editor,
	setting,
	onOpenProviderEditor,
	onCloseEditor,
	onDeleteProvider,
	onSaveProviderDraft,
	onSetProviderDraftPreset,
	onUpdateProviderDraft,
	onUpdateProviderHeadersText,
	getProviderPreset,
}: ProviderSettingsPageProps) {
	return (
		<div class="grid min-w-0 gap-4">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2>Provider</h2>
					<p>Provider を追加・更新・削除できます。接続先の切り替えは Model 編集画面で行います。</p>
				</div>
				<div class="flex flex-wrap items-center gap-2.5">
					<button class="btn btn-ghost btn-sm font-bold border border-[color:var(--vscode-focusBorder)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]" type="button" onClick={() => onOpenProviderEditor()}>
						Provider を追加
					</button>
				</div>
			</div>

			<div class="grid min-w-0 gap-3.5 rounded-[18px] border border-[color:var(--vscode-panel-border)] p-4">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h3>Provider 一覧</h3>
					</div>
				</div>

				<div class="grid min-w-0 gap-3">
					{setting.providers.length === 0 ? (
						<div class="grid gap-2.5 p-3.5 rounded-2xl border border-[color:var(--vscode-panel-border)]">
							<p>Provider がありません。</p>
							<p class="m-0">Provider を追加すると Model を作成できるようになります。</p>
						</div>
					) : (
						setting.providers.map((provider) => {
							const preset = getProviderPreset(provider);

							return (
								<article
									key={provider.id}
									class={`grid gap-2.5 p-3.5 rounded-2xl border border-[color:var(--vscode-panel-border)] ${provider.id === setting.selectedProviderId ? 'border-[color:var(--vscode-focusBorder)]' : ''}`}
								>
									<div class="flex flex-wrap items-start justify-between gap-2.5">
										<div>
											<h3>{provider.name}</h3>
											<p>{provider.baseUrl}</p>
										</div>
										<span class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] border-[color:var(--vscode-panel-border)]">{provider.enabled ? 'enabled' : 'disabled'}</span>
									</div>

									<div class="flex flex-wrap gap-2.5 text-sm">
										<span>{preset ? preset.name : 'Custom'}</span>
										<span>{provider.apiKey?.trim().length ? 'apiKey: set' : 'apiKey: empty'}</span>
									</div>

									{provider.description ? <p class="m-0 break-words">{provider.description}</p> : null}

									<div class="flex flex-wrap gap-2">
										<button
											class="btn btn-ghost btn-sm font-semibold border border-[color:var(--vscode-panel-border)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]"
											type="button"
											onClick={(event) => {
												event.stopPropagation();
												onOpenProviderEditor(provider);
											}}
										>
											編集
										</button>
										<button
											class="btn btn-ghost btn-sm font-semibold border border-[color:var(--vscode-errorForeground)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]"
											type="button"
											onClick={(event) => {
												event.stopPropagation();
												onDeleteProvider(provider.id);
											}}
										>
											削除
										</button>
									</div>
								</article>
							);
						})
					)}
				</div>

				<div class="grid min-w-0 gap-3.5 rounded-[18px] border border-[color:var(--vscode-panel-border)] p-4">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div>
							<h3>Provider CRUD</h3>
							<p>{editor ? `${editor.kind === 'provider' ? 'Provider' : 'Model'} の ${editor.mode === 'create' ? '追加' : '更新'} を行います。` : 'カードを選ぶとここで編集できます。'}</p>
						</div>
						{editor ? (
							<button class="btn btn-ghost btn-sm font-semibold border border-[color:var(--vscode-panel-border)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]" type="button" onClick={onCloseEditor}>
								閉じる
							</button>
						) : null}
					</div>

					{editor && editor.kind === 'provider' ? (
						<div class="grid gap-3.5">
							{editor.errorMessage ? <p class="m-0">{editor.errorMessage}</p> : null}
							<label class="grid min-w-0 gap-2">
								<span>Preset</span>
								<select value={editor.draft.presetId ?? 'custom'} onChange={(event) => onSetProviderDraftPreset((event.currentTarget as HTMLSelectElement).value as 'custom' | 'cometapi' | 'openrouter')}>
									<option value="custom">Custom</option>
									{providerPresets.map((preset) => (
										<option key={preset.id} value={preset.id}>
											{preset.name}
										</option>
									))}
								</select>
							</label>
							<div class="grid min-w-0 gap-3 grid-cols-1 md:grid-cols-2">
								<label class="grid min-w-0 gap-2">
									<span>Name</span>
									<input value={editor.draft.name} onInput={(event) => onUpdateProviderDraft({ name: (event.currentTarget as HTMLInputElement).value })} />
								</label>
								<label class="grid min-w-0 gap-2">
									<span>Base URL</span>
									<input value={editor.draft.baseUrl} onInput={(event) => onUpdateProviderDraft({ baseUrl: (event.currentTarget as HTMLInputElement).value })} />
								</label>
							</div>
							<label class="grid min-w-0 gap-2">
								<span>API Key</span>
								<input type="password" value={editor.draft.apiKey ?? ''} onInput={(event) => onUpdateProviderDraft({ apiKey: (event.currentTarget as HTMLInputElement).value })} />
							</label>
							<label class="grid min-w-0 gap-2">
								<span>Description</span>
								<textarea rows={3} value={editor.draft.description} onInput={(event) => onUpdateProviderDraft({ description: (event.currentTarget as HTMLTextAreaElement).value })} />
							</label>
							<label class="grid min-w-0 gap-2">
								<span>Headers JSON</span>
								<textarea rows={5} value={editor.headersText} onInput={(event) => onUpdateProviderHeadersText((event.currentTarget as HTMLTextAreaElement).value)} />
							</label>
							<label class="inline-flex items-center gap-2.5">
								<input type="checkbox" checked={editor.draft.enabled} onChange={(event) => onUpdateProviderDraft({ enabled: (event.currentTarget as HTMLInputElement).checked })} />
								<span>Enabled</span>
							</label>
							<div class="flex flex-wrap items-center gap-2.5">
								<button class="btn btn-ghost btn-sm font-bold border border-[color:var(--vscode-focusBorder)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]" type="button" onClick={onSaveProviderDraft}>
									保存
								</button>
								<button class="btn btn-ghost btn-sm font-semibold border border-[color:var(--vscode-panel-border)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]" type="button" onClick={onCloseEditor}>
									キャンセル
								</button>
							</div>
						</div>
					) : (
						<div class="grid gap-2.5 p-3.5 rounded-2xl border border-[color:var(--vscode-panel-border)]">
							<p>編集対象を選ぶと、ここで追加・更新できます。</p>
							<p class="m-0">右側で入力し、保存すると設定ファイルへ反映されます。</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
