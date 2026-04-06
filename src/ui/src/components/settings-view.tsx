import { providerPresets, type ModelConfig, type ProviderConfig } from '../../../core/index';
import type { EditorState, ExtensionState, SettingsNavigationEntry, SettingsSection } from '../types';

type SettingsViewProps = {
	bootstrapState: ExtensionState;
	editor: EditorState | null;
	setting: {
		selectedProviderId: string;
		selectedModelId: string;
		providers: ProviderConfig[];
		models: ModelConfig[];
	};
	settingsNavigation: SettingsNavigationEntry[];
	activeSettingsPanel: SettingsSection;
	selectedProvider?: ProviderConfig;
	selectedModel?: ModelConfig;
	providerModels: ModelConfig[];
	syncStatus: 'idle' | 'saving' | 'saved' | 'error';
	syncMessage: string;
	onReturnToWorkspace: () => void;
	onOpenSettings: (section: SettingsSection) => void;
	onOpenProviderEditor: (provider?: ProviderConfig) => void;
	onOpenModelEditor: (model?: ModelConfig) => void;
	onCloseEditor: () => void;
	onSelectProvider: (providerId: string) => void;
	onSelectModel: (modelId: string) => void;
	onDeleteProvider: (providerId: string) => void;
	onDeleteModel: (modelId: string) => void;
	onSaveProviderDraft: () => void;
	onSaveModelDraft: () => void;
	onSetProviderDraftPreset: (presetId: 'custom' | 'cometapi' | 'openrouter') => void;
	onSetModelProviderId: (providerId: string) => void;
	onUpdateProviderDraft: (patch: Partial<ProviderConfig>) => void;
	onUpdateProviderHeadersText: (value: string) => void;
	onUpdateModelDraft: (patch: Partial<ModelConfig>) => void;
	getProviderPreset: (provider: ProviderConfig) => { name: string } | undefined;
};

export function SettingsView({
	bootstrapState,
	editor,
	setting,
	settingsNavigation,
	activeSettingsPanel,
	selectedProvider,
	selectedModel,
	providerModels,
	syncStatus,
	syncMessage,
	onReturnToWorkspace,
	onOpenSettings,
	onOpenProviderEditor,
	onOpenModelEditor,
	onCloseEditor,
	onSelectProvider,
	onSelectModel,
	onDeleteProvider,
	onDeleteModel,
	onSaveProviderDraft,
	onSaveModelDraft,
	onSetProviderDraftPreset,
	onSetModelProviderId,
	onUpdateProviderDraft,
	onUpdateProviderHeadersText,
	onUpdateModelDraft,
	getProviderPreset,
}: SettingsViewProps) {
	return (
		<div class="grid w-full min-w-0 items-stretch overflow-hidden rounded-[20px] border border-[color:var(--vscode-panel-border)] grid-cols-1 md:[grid-template-columns:minmax(15.5rem,17.5rem)_minmax(0,1fr)]">
			<div class="min-w-0 border-b border-[color:var(--vscode-panel-border)] md:border-b-0 md:border-r">
				<aside class="grid min-h-full content-start gap-2.5 px-3 py-3 md:sticky md:top-0" aria-label="設定カテゴリ">
					<div class="inline-flex h-4 w-4 items-center justify-center" aria-hidden="true">
						□
					</div>

					<ul class="m-0 grid list-none gap-1 p-0">
						{settingsNavigation.map((entry) => (
							<li key={entry.key}>
								<button
									class="flex w-full items-center justify-start gap-2.5 rounded-xl border-0 px-3 py-2 text-left transition-colors duration-150"
									type="button"
									onClick={() => onOpenSettings(entry.key)}
									aria-pressed={activeSettingsPanel === entry.key}
								>
									<span class="inline-flex h-5 w-5 shrink-0 items-center justify-center text-sm">{entry.icon}</span>
									<span class="min-w-0 text-sm font-medium leading-tight">{entry.label}</span>
								</button>
							</li>
						))}
					</ul>
				</aside>
			</div>

			<div class="min-w-0">
				<div class="grid min-w-0 gap-4 px-5 pt-4 pb-6">
					<div class="flex flex-wrap items-end justify-between gap-3">
						<div>
							<p class="m-0 mb-2 text-xs font-bold uppercase tracking-[0.16em]">Codex Settings</p>
							<h2>設定</h2>
							<p>左のメニューでページを切り替え、右側で CRUD を操作します。</p>
						</div>
						<div class="flex flex-wrap items-center gap-2.5">
							<button class="btn btn-ghost btn-sm font-semibold border border-[color:var(--vscode-panel-border)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]" type="button" onClick={onReturnToWorkspace}>
								実行画面へ戻る
							</button>
						</div>
					</div>

					{activeSettingsPanel === 'general' ? (
						<div class="grid min-w-0 gap-4">
							<div class="flex flex-wrap items-start justify-between gap-3">
								<div>
									<h2>一般</h2>
									<p>設定画面の状態と、いま選択されている Provider / Model を確認できます。</p>
								</div>
								<div class="flex flex-wrap items-center gap-2.5">
									<button class="btn btn-ghost btn-sm font-bold border border-[color:var(--vscode-focusBorder)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]" type="button" onClick={() => onOpenSettings('provider')}>
										Provider
									</button>
									<button class="btn btn-ghost btn-sm font-semibold border border-[color:var(--vscode-panel-border)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]" type="button" onClick={() => onOpenSettings('model')}>
										Model
									</button>
								</div>
							</div>

							<div class="grid min-w-0 gap-3 grid-cols-1 lg:grid-cols-3">
								<article class="grid min-w-0 gap-2.5 p-3.5 rounded-2xl border border-[color:var(--vscode-panel-border)]">
									<p class="m-0 text-xs font-bold uppercase tracking-[0.12em]">保存先</p>
									<h3>{bootstrapState.filePath}</h3>
									<p class="m-0">{bootstrapState.message}</p>
								</article>
								<article class="grid min-w-0 gap-2.5 p-3.5 rounded-2xl border border-[color:var(--vscode-panel-border)]">
									<p class="m-0 text-xs font-bold uppercase tracking-[0.12em]">現在の選択</p>
									<h3>{selectedProvider ? selectedProvider.name : '未選択'}</h3>
									<p class="m-0">{selectedModel ? selectedModel.name : 'Model 未選択'}</p>
								</article>
								<article class="grid min-w-0 gap-2.5 p-3.5 rounded-2xl border border-[color:var(--vscode-panel-border)]">
									<p class="m-0 text-xs font-bold uppercase tracking-[0.12em]">状態</p>
									<h3>{syncStatus}</h3>
									<p class="m-0">{syncMessage}</p>
								</article>
							</div>

							<div class="flex flex-wrap items-center gap-2.5">
								<button class="btn btn-ghost btn-sm font-bold border border-[color:var(--vscode-focusBorder)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]" type="button" onClick={() => onOpenSettings('provider')}>
									Provider を編集
								</button>
								<button class="btn btn-ghost btn-sm font-semibold border border-[color:var(--vscode-panel-border)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]" type="button" onClick={() => onOpenSettings('model')}>
									Model を編集
								</button>
							</div>
						</div>
					) : null}

					{activeSettingsPanel === 'provider' ? (
						<div class="grid min-w-0 gap-4">
							<div class="flex flex-wrap items-start justify-between gap-3">
								<div>
									<h2>Provider</h2>
									<p>Provider を追加・更新・削除できます。選択中の Provider は Model 側にも反映されます。</p>
								</div>
								<div class="flex flex-wrap items-center gap-2.5">
									<button class="btn btn-ghost btn-sm font-bold border border-[color:var(--vscode-focusBorder)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]" type="button" onClick={() => onOpenProviderEditor()}>
										Provider を追加
									</button>
									<button class="btn btn-ghost btn-sm font-semibold border border-[color:var(--vscode-panel-border)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]" type="button" onClick={() => onOpenSettings('model')}>
										Model へ
									</button>
								</div>
							</div>

							<div class="grid min-w-0 gap-3.5 rounded-[18px] border border-[color:var(--vscode-panel-border)] p-4">
								<div class="flex flex-wrap items-start justify-between gap-3">
									<div>
										<h3>Provider 一覧</h3>
										<p>一覧から選択し、右側の CRUD で編集できます。</p>
									</div>
									<div class="flex flex-wrap items-center gap-2.5">
										<button class="btn btn-ghost btn-sm font-bold border border-[color:var(--vscode-focusBorder)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]" type="button" onClick={() => onOpenProviderEditor()}>
											Provider を追加
										</button>
										<button class="btn btn-ghost btn-sm font-semibold border border-[color:var(--vscode-panel-border)] hover:-translate-y-px hover:border-[color:var(--vscode-focusBorder)] focus-visible:outline-none focus-visible:border-[color:var(--vscode-focusBorder)]" type="button" onClick={() => onOpenSettings('model')}>
											Model へ
										</button>
									</div>
								</div>

								<div class="grid min-w-0 gap-3 max-h-[300px] overflow-auto pr-0.5">
									{setting.providers.length === 0 ? (
										<div class="grid gap-2.5 p-3.5 rounded-2xl border border-[color:var(--vscode-panel-border)]">
											<p>Provider がありません。</p>
											<p class="m-0">Provider を追加すると Model を作成できるようになります。</p>
										</div>
									) : (
										setting.providers.map((provider) => {
											const preset = getProviderPreset(provider);
											const isSelected = provider.id === setting.selectedProviderId;

											return (
												<article
													key={provider.id}
													class={`grid cursor-pointer gap-2.5 p-3.5 rounded-2xl border border-[color:var(--vscode-panel-border)] ${isSelected ? 'border-[color:var(--vscode-focusBorder)]' : ''}`}
													onClick={() => onSelectProvider(provider.id)}
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
					) : null}

					{activeSettingsPanel === 'model' ? (
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
					) : null}
				</div>
			</div>
		</div>
	);
}
