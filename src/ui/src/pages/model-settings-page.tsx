import type { ModelSettingsPageProps } from './types';

export function ModelSettingsPage({
	editor,
	setting,
	onOpenModelEditor,
	onCloseEditor,
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
					<p>全ての Model を一覧で表示し、追加・更新・削除できます。</p>
				</div>
				<div class="flex flex-wrap items-center gap-2.5">
					<button class="btn btn-ghost btn-sm font-bold border border-[color:var(--vscode-focusBorder)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]" type="button" onClick={() => onOpenModelEditor()}>
						Model を追加
					</button>
				</div>
			</div>

			<div class="grid min-w-0 gap-3.5 rounded-[18px] border border-[color:var(--vscode-panel-border)] p-4">
				<div class="flex flex-wrap items-start justify-between gap-3">
					<div>
						<h3>Model 一覧</h3>
					</div>
				</div>

				<div class="grid min-w-0 gap-3">
					{setting.models.length === 0 ? (
						<div class="grid gap-2.5 p-3.5 rounded-2xl border border-[color:var(--vscode-panel-border)]">
							<p>Model がありません。</p>
							<p class="m-0">Model を追加するとここに一覧表示されます。</p>
						</div>
					) : (
						setting.models.map((model) => {
							return (
								<article
									key={model.id}
									class="flex items-center justify-between gap-3 p-3.5 rounded-2xl border border-[color:var(--vscode-panel-border)]"
								>
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
							<p class="m-0">Model を選ぶと、編集や削除を行えます。</p>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
