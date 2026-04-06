import { createDefaultSettingConfig, createIdleWorkspaceExecutionState, normalizeSettingConfig } from '../../../core/index';
import type { ExtensionState, VsCodeApi } from '../types';

const fallbackSetting = createDefaultSettingConfig();

export const fallbackBootstrapState: ExtensionState = {
	surface: 'workspace',
	setting: fallbackSetting,
	workspaceExecution: createIdleWorkspaceExecutionState(fallbackSetting),
	filePath: '~/.permosa/setting.json',
	loadMode: 'default',
	message: 'ローカルプレビューを表示しています。',
};

export function readBootstrapState(): ExtensionState {
	const element = document.getElementById('permosa-initial-state');
	const raw = element?.textContent?.trim();

	if (raw) {
		try {
			const parsed = JSON.parse(raw) as ExtensionState;
			if (parsed?.setting) {
				const setting = normalizeSettingConfig(parsed.setting);
				return {
					...parsed,
					surface: parsed.surface ?? 'workspace',
					setting,
					workspaceExecution: parsed.workspaceExecution ?? createIdleWorkspaceExecutionState(setting),
				};
			}
		} catch {
			// fall through to fallback state
		}
	}

	return fallbackBootstrapState;
}

export function getVsCodeApi() {
	const provider = globalThis as typeof globalThis & {
		acquireVsCodeApi?: () => VsCodeApi;
	};

	return typeof provider.acquireVsCodeApi === 'function' ? provider.acquireVsCodeApi() : undefined;
}
