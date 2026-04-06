import { providerPresets } from '../../../core/index';
import type { ProviderSettingsPageProps } from './types';
import { fieldClass } from '../consts';

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
	const editingProviderId = editor && editor.kind === 'provider' && editor.mode === 'edit' ? editor.draft.id : null;
	const isCreatingProvider = editor?.kind === 'provider' && editor.mode === 'create';

	return (
		<div class="grid min-w-0 gap-4">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2>Provider</h2>
				</div>
			</div>

			<div class="grid min-w-0 gap-3.5 rounded-[18px] border border-[color:var(--vscode-panel-border)] p-4">
				<div class="flex flex-wrap items-start justify-between gap-3">
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
							const isEditingCurrentProvider = editingProviderId === provider.id;

							return (
								<article
									key={provider.id}
									class={`grid gap-3 p-3.5 rounded-2xl border border-[color:var(--vscode-panel-border)] ${isEditingCurrentProvider ? 'border-[color:var(--vscode-focusBorder)]' : ''}`}
								>
									{isEditingCurrentProvider ? (
										<div class="grid gap-3">
											<div class="flex flex-wrap items-start justify-between gap-3">
												<div>
													<h3>{provider.name}</h3>
													<p class="m-0">この Provider を一覧内で編集しています。</p>
												</div>
												<span class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] border-[color:var(--vscode-focusBorder)]">
													編集中
												</span>
											</div>

											{editor && editor.kind === 'provider' ? (
												<div class="grid gap-3.5">
													{editor.errorMessage ? <p class="m-0">{editor.errorMessage}</p> : null}
													<label class="grid min-w-0 gap-2">
														<span>Preset</span>
														<select class={fieldClass} value={editor.draft.presetId ?? 'custom'} onChange={(event) => onSetProviderDraftPreset((event.currentTarget as HTMLSelectElement).value as 'custom' | 'cometapi' | 'openrouter')}>
															<option value="custom">Custom</option>
															{providerPresets.map((presetItem) => (
																<option key={presetItem.id} value={presetItem.id}>
																	{presetItem.name}
																</option>
															))}
														</select>
													</label>
													<div class="grid min-w-0 gap-3 grid-cols-1 md:grid-cols-2">
														<label class="grid min-w-0 gap-2">
															<span>Name</span>
															<input class={fieldClass} value={editor.draft.name} onInput={(event) => onUpdateProviderDraft({ name: (event.currentTarget as HTMLInputElement).value })} />
														</label>
														<label class="grid min-w-0 gap-2">
															<span>Base URL</span>
															<input class={fieldClass} value={editor.draft.baseUrl} onInput={(event) => onUpdateProviderDraft({ baseUrl: (event.currentTarget as HTMLInputElement).value })} />
														</label>
													</div>
													<label class="grid min-w-0 gap-2">
														<span>API Key</span>
														<input class={fieldClass} type="password" value={editor.draft.apiKey ?? ''} onInput={(event) => onUpdateProviderDraft({ apiKey: (event.currentTarget as HTMLInputElement).value })} />
													</label>
													<label class="grid min-w-0 gap-2">
														<span>Description</span>
														<textarea class={fieldClass} rows={3} value={editor.draft.description} onInput={(event) => onUpdateProviderDraft({ description: (event.currentTarget as HTMLTextAreaElement).value })} />
													</label>
													<label class="grid min-w-0 gap-2">
														<span>Headers JSON</span>
														<textarea class={fieldClass} rows={5} value={editor.headersText} onInput={(event) => onUpdateProviderHeadersText((event.currentTarget as HTMLTextAreaElement).value)} />
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
											) : null}
										</div>
									) : (
										<>
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
										</>
									)}
								</article>
							);
						})
					)}
					<details class={`collapse collapse-arrow rounded-2xl border border-[color:var(--vscode-panel-border)] ${isCreatingProvider ? 'collapse-open' : ''}`} open={isCreatingProvider}>
						<summary
							class="collapse-title font-semibold"
							onClick={(event) => {
								if (!isCreatingProvider) {
									onOpenProviderEditor();
								}

								event.preventDefault();
							}}
						>
							Provider を追加
						</summary>
						<div class="collapse-content grid gap-3.5">
							{editor && editor.kind === 'provider' ? (
								<div class="grid gap-3.5">
									{editor.errorMessage ? <p class="m-0">{editor.errorMessage}</p> : null}
									<label class="grid min-w-0 gap-2">
										<span>Preset</span>
										<select class={fieldClass} value={editor.draft.presetId ?? 'custom'} onChange={(event) => onSetProviderDraftPreset((event.currentTarget as HTMLSelectElement).value as 'custom' | 'cometapi' | 'openrouter')}>
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
											<input class={fieldClass} value={editor.draft.name} onInput={(event) => onUpdateProviderDraft({ name: (event.currentTarget as HTMLInputElement).value })} />
										</label>
										<label class="grid min-w-0 gap-2">
											<span>Base URL</span>
											<input class={fieldClass} value={editor.draft.baseUrl} onInput={(event) => onUpdateProviderDraft({ baseUrl: (event.currentTarget as HTMLInputElement).value })} />
										</label>
									</div>
									<label class="grid min-w-0 gap-2">
										<span>API Key</span>
										<input class={fieldClass} type="password" value={editor.draft.apiKey ?? ''} onInput={(event) => onUpdateProviderDraft({ apiKey: (event.currentTarget as HTMLInputElement).value })} />
									</label>
									<label class="grid min-w-0 gap-2">
										<span>Description</span>
										<textarea class={fieldClass} rows={3} value={editor.draft.description} onInput={(event) => onUpdateProviderDraft({ description: (event.currentTarget as HTMLTextAreaElement).value })} />
									</label>
									<label class="grid min-w-0 gap-2">
										<span>Headers JSON</span>
										<textarea class={fieldClass} rows={5} value={editor.headersText} onInput={(event) => onUpdateProviderHeadersText((event.currentTarget as HTMLTextAreaElement).value)} />
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
							) : null}
						</div>
					</details>
				</div>
			</div>
		</div>
	);
}
