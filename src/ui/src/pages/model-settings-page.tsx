import type { ModelSettingsPageProps } from './types';
import { fieldClass } from '../consts';

export function ModelSettingsPage({
	editor,
	settings,
	onOpenModelEditor,
	onCloseEditor,
	onDeleteModel,
	onSaveModelDraft,
	onSetModelProviderId,
	onUpdateModelDraft,
}: ModelSettingsPageProps) {
	const editingModelId = editor && editor.kind === 'model' && editor.mode === 'edit' ? editor.draft.id : null;
	const isCreatingModel = editor?.kind === 'model' && editor.mode === 'create';

	return (
		<div class="grid min-w-0 gap-4">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2>Model</h2>
				</div>
			</div>

			<div class="grid min-w-0 gap-3.5 rounded-[18px] border border-[color:var(--vscode-panel-border)] p-4">
				<div class="grid min-w-0 gap-3">
					{settings.models.length === 0 ? (
						<div class="grid gap-2.5 rounded-2xl border border-[color:var(--vscode-panel-border)] p-3.5">
							<p>Model がありません。</p>
							<p class="m-0">Model を追加するとここに一覧表示されます。</p>
						</div>
					) : (
						settings.models.map((model) => {
							const isEditingCurrentModel = editingModelId === model.id;

							return (
								<article
									key={model.id}
									class={`grid gap-3 rounded-2xl border border-[color:var(--vscode-panel-border)] p-3.5 ${isEditingCurrentModel ? 'border-[color:var(--vscode-focusBorder)]' : ''}`}
								>
									{isEditingCurrentModel ? (
										<div class="grid gap-3">
											<div class="flex flex-wrap items-start justify-between gap-3">
												<div>
													<h3>{model.name}</h3>
												</div>
												<span class="inline-flex items-center rounded-full border border-[color:var(--vscode-focusBorder)] px-3 py-1 text-xs font-bold uppercase tracking-[0.1em]">
													編集中
												</span>
											</div>

											{editor && editor.kind === 'model' ? (
												<div class="grid gap-3.5">
													{editor.errorMessage ? <p class="m-0">{editor.errorMessage}</p> : null}
													<label class="grid min-w-0 gap-2">
														<span>Provider</span>
														<select
															class={fieldClass}
															value={editor.draft.providerId}
															onChange={(event) => onSetModelProviderId((event.currentTarget as HTMLSelectElement).value)}
														>
															{settings.providers.length === 0 ? <option value="">Provider を追加してください</option> : null}
															{settings.providers.map((provider) => (
																<option key={provider.id} value={provider.id}>
																	{provider.name}
																</option>
															))}
														</select>
													</label>
													<div class="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
														<label class="grid min-w-0 gap-2">
															<span>Name</span>
															<input
																class={fieldClass}
																value={editor.draft.name}
																onInput={(event) => onUpdateModelDraft({ name: (event.currentTarget as HTMLInputElement).value })}
															/>
														</label>
														<label class="grid min-w-0 gap-2">
															<span>Model ID</span>
															<input
																class={fieldClass}
																value={editor.draft.modelId}
																onInput={(event) => onUpdateModelDraft({ modelId: (event.currentTarget as HTMLInputElement).value })}
															/>
														</label>
													</div>
													<label class="inline-flex items-center gap-2.5">
														<input
															type="checkbox"
															checked={editor.draft.enabled}
															onChange={(event) => onUpdateModelDraft({ enabled: (event.currentTarget as HTMLInputElement).checked })}
														/>
														<span>Enabled</span>
													</label>
													<div class="flex flex-wrap items-center gap-2.5">
														<button
															class="btn btn-ghost btn-sm font-bold border border-[color:var(--vscode-focusBorder)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]"
															type="button"
															onClick={onSaveModelDraft}
														>
															保存
														</button>
														<button
															class="btn btn-ghost btn-sm font-semibold border border-[color:var(--vscode-errorForeground)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]"
															type="button"
															onClick={() => onDeleteModel(model.id)}
														>
															削除
														</button>
														<button
															class="btn btn-ghost btn-sm font-semibold border border-[color:var(--vscode-panel-border)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]"
															type="button"
															onClick={onCloseEditor}
														>
															キャンセル
														</button>
													</div>
												</div>
											) : null}
										</div>
									) : (
										<>
											<div class="flex flex-wrap items-start justify-between gap-3">
												<h3 class="min-w-0 flex-1">{model.name}</h3>
												<div class="flex shrink-0 flex-nowrap gap-2">
													<button
														class="btn btn-ghost btn-sm font-semibold border border-[color:var(--vscode-panel-border)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]"
														type="button"
														onClick={(event) => {
															event.stopPropagation();
															onOpenModelEditor(model);
														}}
													>
														編集
													</button>
													<button
														class="btn btn-ghost btn-sm font-semibold border border-[color:var(--vscode-errorForeground)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]"
														type="button"
														onClick={(event) => {
															event.stopPropagation();
															onDeleteModel(model.id);
														}}
													>
														削除
													</button>
												</div>
											</div>
											<div class="flex flex-wrap gap-2.5 text-sm">
												<span>{settings.providers.find((provider) => provider.id === model.providerId)?.name ?? 'Provider 未設定'}</span>
												<span>{model.enabled ? 'enabled' : 'disabled'}</span>
											</div>
										</>
									)}
								</article>
							);
						})
					)}

					<details class={`collapse collapse-arrow rounded-2xl border border-[color:var(--vscode-panel-border)] ${isCreatingModel ? 'collapse-open' : ''}`} open={isCreatingModel}>
						<summary
							class="collapse-title font-semibold"
							onClick={(event) => {
								if (!isCreatingModel) {
									onOpenModelEditor();
								}

								event.preventDefault();
							}}
						>
							Model を追加
						</summary>
						<div class="collapse-content grid gap-3.5">
							<p>カードを選ぶとここで追加できます。</p>
							{editor && editor.kind === 'model' ? (
								<div class="grid gap-3.5">
									{editor.errorMessage ? <p class="m-0">{editor.errorMessage}</p> : null}
									<label class="grid min-w-0 gap-2">
										<span>Provider</span>
										<select
											class={fieldClass}
											value={editor.draft.providerId}
											onChange={(event) => onSetModelProviderId((event.currentTarget as HTMLSelectElement).value)}
										>
											{settings.providers.length === 0 ? <option value="">Provider を追加してください</option> : null}
											{settings.providers.map((provider) => (
												<option key={provider.id} value={provider.id}>
													{provider.name}
												</option>
											))}
										</select>
									</label>
									<div class="grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
										<label class="grid min-w-0 gap-2">
											<span>Name</span>
											<input
												class={fieldClass}
												value={editor.draft.name}
												onInput={(event) => onUpdateModelDraft({ name: (event.currentTarget as HTMLInputElement).value })}
											/>
										</label>
										<label class="grid min-w-0 gap-2">
											<span>Model ID</span>
											<input
												class={fieldClass}
												value={editor.draft.modelId}
												onInput={(event) => onUpdateModelDraft({ modelId: (event.currentTarget as HTMLInputElement).value })}
											/>
										</label>
									</div>
									<label class="inline-flex items-center gap-2.5">
										<input
											type="checkbox"
											checked={editor.draft.enabled}
											onChange={(event) => onUpdateModelDraft({ enabled: (event.currentTarget as HTMLInputElement).checked })}
										/>
										<span>Enabled</span>
									</label>
									<div class="flex flex-wrap items-center gap-2.5">
										<button
											class="btn btn-ghost btn-sm font-bold border border-[color:var(--vscode-focusBorder)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]"
											type="button"
											onClick={onSaveModelDraft}
										>
											保存
										</button>
										<button
											class="btn btn-ghost btn-sm font-semibold border border-[color:var(--vscode-panel-border)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]"
											type="button"
											onClick={onCloseEditor}
										>
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
