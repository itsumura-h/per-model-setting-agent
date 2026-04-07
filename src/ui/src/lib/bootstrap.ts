import {
	createDefaultSettingConfig,
	createIdleWorkspaceExecutionState,
	createIdleWorkspaceFileEditState,
	createWorkspaceFileEditSafetyNotice,
	normalizeSettingConfig,
} from '../../../core/index';
import type { ExtensionState, VsCodeApi } from '../types';

const fallbackSetting = createDefaultSettingConfig();

export const fallbackBootstrapState: ExtensionState = {
	surface: 'workspace',
	setting: fallbackSetting,
	workspaceExecution: createIdleWorkspaceExecutionState(fallbackSetting),
	workspaceFileEdit: createIdleWorkspaceFileEditState(),
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
				const workspaceExecution = normalizeWorkspaceExecutionState(parsed.workspaceExecution, setting);
				const workspaceFileEdit = parsed.workspaceFileEdit ?? createIdleWorkspaceFileEditState();
				return {
					...parsed,
					surface: parsed.surface ?? 'workspace',
					setting,
					workspaceExecution,
					workspaceFileEdit: {
						...workspaceFileEdit,
						safetyNotice: workspaceFileEdit.safetyNotice ?? createWorkspaceFileEditSafetyNotice(),
					},
				};
			}
		} catch {
			// fall through to fallback state
		}
	}

	return fallbackBootstrapState;
}

function normalizeWorkspaceExecutionState(
	workspaceExecution: ExtensionState['workspaceExecution'] | undefined,
	setting: ExtensionState['setting'],
) {
	const nextWorkspaceExecution = workspaceExecution ?? createIdleWorkspaceExecutionState(setting);

	return {
		...nextWorkspaceExecution,
		fileEditSafetyNotice: nextWorkspaceExecution.fileEditSafetyNotice ?? createWorkspaceFileEditSafetyNotice(),
		messages:
			Array.isArray(nextWorkspaceExecution.messages) && nextWorkspaceExecution.messages.length > 0
				? nextWorkspaceExecution.messages
				: createIdleWorkspaceExecutionState(setting).messages,
	};
}

export function getVsCodeApi() {
	const provider = globalThis as typeof globalThis & {
		acquireVsCodeApi?: () => VsCodeApi;
	};

	return typeof provider.acquireVsCodeApi === 'function' ? provider.acquireVsCodeApi() : undefined;
}
