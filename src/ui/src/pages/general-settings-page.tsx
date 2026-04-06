import type { GeneralSettingsPageProps } from './types';

export function GeneralSettingsPage({
	bootstrapState,
}: GeneralSettingsPageProps) {
	return (
		<div class="grid min-w-0 gap-4">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div>
					<h2>一般</h2>
				</div>
			</div>

			<div class="grid min-w-0 gap-3 grid-cols-1 lg:grid-cols-3">
				<article class="grid min-w-0 gap-2.5 p-3.5 rounded-2xl border border-[color:var(--vscode-panel-border)]">
					<p class="m-0 text-xs font-bold uppercase tracking-[0.12em]">保存先</p>
					<h3>{bootstrapState.filePath}</h3>
					<p class="m-0">{bootstrapState.message}</p>
				</article>
			</div>
		</div>
	);
}
