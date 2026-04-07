import {
	createAgentToolFileEditSafetyNotice,
	createDefaultSettingsConfig,
	createIdleAgentToolFileEditState,
	createIdleWorkspaceExecutionState,
	normalizeSettingsConfig,
} from '../../../core/index';
import type { AppState, VsCodeApi } from '../types';

const fallbackSettings = createDefaultSettingsConfig();

export const fallbackBootstrapState: AppState = {
	viewMode: 'workspace',
	settings: fallbackSettings,
	workspaceExecution: createIdleWorkspaceExecutionState(fallbackSettings),
	agentToolFileEdit: createIdleAgentToolFileEditState(),
	filePath: '~/.permosa/setting.json',
	loadStatus: 'fallback',
	statusMessage: 'ローカルプレビューを表示しています。',
};

function migrateLoadStatus(raw: Record<string, unknown>): 'fallback' | 'loaded' | 'corrupt' {
	if (raw.loadStatus === 'fallback' || raw.loadStatus === 'loaded' || raw.loadStatus === 'corrupt') {
		return raw.loadStatus;
	}
	if (raw.loadMode === 'loaded' || raw.loadMode === 'corrupt') {
		return raw.loadMode;
	}
	if (raw.loadMode === 'default') {
		return 'fallback';
	}
	return 'fallback';
}

export function readBootstrapState(): AppState {
	const element = document.getElementById('permosa-initial-state');
	const raw = element?.textContent?.trim();

	if (raw) {
		try {
			const parsed = JSON.parse(raw) as Record<string, unknown>;
			const settingsRaw = parsed.settings ?? parsed.setting;
			if (settingsRaw && typeof settingsRaw === 'object') {
				const settings = normalizeSettingsConfig(settingsRaw as Parameters<typeof normalizeSettingsConfig>[0]);
				const workspaceExecution = normalizeWorkspaceExecutionState(
					parsed.workspaceExecution as AppState['workspaceExecution'] | undefined,
					settings,
				);
				const legacyToolEdit = parsed.agentToolFileEdit ?? parsed.workspaceFileEdit;
				const agentToolFileEdit =
					(legacyToolEdit as AppState['agentToolFileEdit'] | undefined) ?? createIdleAgentToolFileEditState();
				const viewMode =
					parsed.viewMode === 'settings' || parsed.viewMode === 'workspace'
						? parsed.viewMode
						: parsed.surface === 'settings' || parsed.surface === 'workspace'
							? parsed.surface
							: 'workspace';
				return {
					...(parsed as unknown as AppState),
					viewMode,
					settings,
					workspaceExecution,
					agentToolFileEdit: {
						...agentToolFileEdit,
						safetyNotice: agentToolFileEdit.safetyNotice ?? createAgentToolFileEditSafetyNotice(),
					},
					loadStatus: migrateLoadStatus(parsed),
					statusMessage:
						typeof parsed.statusMessage === 'string'
							? parsed.statusMessage
							: typeof parsed.message === 'string'
								? parsed.message
								: fallbackBootstrapState.statusMessage,
				};
			}
		} catch {
			// fall through to fallback state
		}
	}

	return fallbackBootstrapState;
}

type LegacyWorkspaceExecution = AppState['workspaceExecution'] & {
	fileEditSafetyNotice?: AppState['workspaceExecution']['agentToolFileEditSafetyNotice'];
};

function normalizeWorkspaceExecutionState(
	workspaceExecution: AppState['workspaceExecution'] | undefined,
	settings: AppState['settings'],
) {
	const nextWorkspaceExecution = workspaceExecution ?? createIdleWorkspaceExecutionState(settings);
	const legacy = nextWorkspaceExecution as LegacyWorkspaceExecution;

	return {
		...nextWorkspaceExecution,
		agentToolFileEditSafetyNotice:
			nextWorkspaceExecution.agentToolFileEditSafetyNotice ??
			legacy.fileEditSafetyNotice ??
			createAgentToolFileEditSafetyNotice(),
		messages:
			Array.isArray(nextWorkspaceExecution.messages) && nextWorkspaceExecution.messages.length > 0
				? nextWorkspaceExecution.messages
				: createIdleWorkspaceExecutionState(settings).messages,
	};
}

export function getVsCodeApi() {
	const provider = globalThis as typeof globalThis & {
		acquireVsCodeApi?: () => VsCodeApi;
	};

	return typeof provider.acquireVsCodeApi === 'function' ? provider.acquireVsCodeApi() : undefined;
}
