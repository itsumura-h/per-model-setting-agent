import type { ModelSettingsPageProps } from './types';

export function ModelSettingsPage({
	editor,
	setting,
	selectedProvider,
	providerModels,
	onOpenSettings,
	onOpenModelEditor,
	onCloseEditor,
	onSelectModel,
	onDeleteModel,
	onSaveModelDraft,
	onSetModelProviderId,
	onUpdateModelDraft,
}: ModelSettingsPageProps) {
	return (
		<div class="grid min-w-0 gap-4">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2>Model</h2>
					<p>選択中 Provider に紐づく Model を管理します。</p>
				</div>
				<div class="flex flex-wrap items-center gap-2.5">
					<button class="btn btn-ghost btn-sm font-bold border border-[color:var(--vscode-focusBorder)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]" type="button" onClick={() => onOpenModelEditor()}>
						Model を追加
					</button>
					<button class="btn btn-ghost btn-sm font-semibold border border-[color:var(--vscode-panel-border)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]" type="button" onClick={() => onOpenSettings('provider')}>
						Provider へ
					</button>
				</div>
			</div>

			<div class="grid min-w-0 gap-3.5 rounded-[18px] border border-[color:var(--vscode-panel-border)] p-4">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h3>Model 一覧</h3>
						<p>{selectedProvider ? `${selectedProvider.name} に紐づく Model を表示します。` : 'Provider を選ぶと Model を表示できます。'}</p>
					</div>
					<div class="flex flex-wrap items-center gap-2.5">
						<button class="btn btn-ghost btn-sm font-bold border border-[color:var(--vscode-focusBorder)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]" type="button" onClick={() => onOpenModelEditor()}>
							Model を追加
						</button>
						<button class="btn btn-ghost btn-sm font-semibold border border-[color:var(--vscode-panel-border)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]" type="button" onClick={() => onOpenSettings('provider')}>
							Provider へ
						</button>
					</div>
				</div>

				<div class="grid min-w-0 gap-3 max-h-[300px] overflow-auto pr-0.5">
					{!selectedProvider ? (
						<div class="grid gap-2.5 p-3.5 rounded-2xl border border-[color:var(--vscode-panel-border)]">
							<p>Provider を選択してください。</p>
						</div>
					) : providerModels.length === 0 ? (
						<div class="grid gap-2.5 p-3.5 rounded-2xl border border-[color:var(--vscode-panel-border)]">
							<p>この Provider には Model がありません。</p>
							<p class="m-0">Model を追加して紐づけてください。</p>
						</div>
					) : (
						providerModels.map((model) => {
							const isSelected = model.id === setting.selectedModelId;

							return (
								<article
									key={model.id}
									class={`grid cursor-pointer gap-2.5 p-3.5 rounded-2xl border border-[color:var(--vscode-panel-border)] ${isSelected ? 'border-[color:var(--vscode-focusBorder)]' : ''}`}
									onClick={() => onSelectModel(model.id)}
								>
									<div class="flex flex-wrap items-start justify-between gap-2.5">
										<div>
											<h3>{model.name}</h3>
											<p>{model.modelId}</p>
										</div>
										<span class="inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.1em] border-[color:var(--vscode-panel-border)]">{model.enabled ? 'enabled' : 'disabled'}</span>
									</div>

									{model.description ? <p class="m-0 break-words">{model.description}</p> : null}

									<div class="flex flex-wrap gap-2">
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
								</article>
							);
						})
					)}
				</div>

				<div class="grid min-w-0 gap-3.5 rounded-[18px] border border-[color:var(--vscode-panel-border)] p-4">
					<div class="flex flex-wrap items-start justify-between gap-3">
						<div>
							<h3>Model CRUD</h3>
							<p>{editor ? `${editor.kind === 'model' ? 'Model' : 'Provider'} の ${editor.mode === 'create' ? '追加' : '更新'} を行います。` : 'カードを選ぶとここで編集できます。'}</p>
						</div>
						{editor ? (
							<button class="btn btn-ghost btn-sm font-semibold border border-[color:var(--vscode-panel-border)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]" type="button" onClick={onCloseEditor}>
								閉じる
							</button>
						) : null}
					</div>

					{editor && editor.kind === 'model' ? (
						<div class="grid gap-3.5">
							{editor.errorMessage ? <p class="m-0">{editor.errorMessage}</p> : null}
							<label class="grid min-w-0 gap-2">
								<span>Provider</span>
								<select value={editor.draft.providerId} onChange={(event) => onSetModelProviderId((event.currentTarget as HTMLSelectElement).value)}>
									{setting.providers.length === 0 ? <option value="">Provider を追加してください</option> : null}
									{setting.providers.map((provider) => (
										<option key={provider.id} value={provider.id}>
											{provider.name}
										</option>
									))}
								</select>
							</label>
							<div class="grid min-w-0 gap-3 grid-cols-1 md:grid-cols-2">
								<label class="grid min-w-0 gap-2">
									<span>Name</span>
									<input value={editor.draft.name} onInput={(event) => onUpdateModelDraft({ name: (event.currentTarget as HTMLInputElement).value })} />
								</label>
								<label class="grid min-w-0 gap-2">
									<span>Model ID</span>
									<input value={editor.draft.modelId} onInput={(event) => onUpdateModelDraft({ modelId: (event.currentTarget as HTMLInputElement).value })} />
								</label>
							</div>
							<label class="grid min-w-0 gap-2">
								<span>Description</span>
								<textarea rows={3} value={editor.draft.description} onInput={(event) => onUpdateModelDraft({ description: (event.currentTarget as HTMLTextAreaElement).value })} />
							</label>
							<label class="inline-flex items-center gap-2.5">
								<input type="checkbox" checked={editor.draft.enabled} onChange={(event) => onUpdateModelDraft({ enabled: (event.currentTarget as HTMLInputElement).checked })} />
								<span>Enabled</span>
							</label>
							<div class="flex flex-wrap items-center gap-2.5">
								<button class="btn btn-ghost btn-sm font-bold border border-[color:var(--vscode-focusBorder)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]" type="button" onClick={onSaveModelDraft}>
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
							<p class="m-0">選択中の Provider に従属して Model を管理します。</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
