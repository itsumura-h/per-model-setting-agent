import type { SettingsNavigationEntry, SettingsSection } from '../types';

type SettingsSidebarProps = {
	settingsNavigation: SettingsNavigationEntry[];
	activeSettingsPanel: SettingsSection;
	onOpenSettings: (section: SettingsSection) => void;
};

export function SettingsSidebar({ settingsNavigation, activeSettingsPanel, onOpenSettings }: SettingsSidebarProps) {
	return (
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
	);
}
