import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { normalizeSettingsConfig, type SettingsConfig } from '../core/index';

export function getSettingsFilePath() {
	return path.join(os.homedir(), '.permosa', 'setting.json');
}

export async function ensureSettingsDirectory() {
	await fs.mkdir(path.dirname(getSettingsFilePath()), { recursive: true });
}

export function isFileNotFound(error: unknown) {
	return error instanceof Error && 'code' in error && (error as NodeJS.ErrnoException).code === 'ENOENT';
}

export async function readPersistedSettingsFile(filePath: string) {
	try {
		const raw = await fs.readFile(filePath, 'utf8');
		const parsed = JSON.parse(raw) as unknown;
		return normalizeSettingsConfig(parsed as Partial<SettingsConfig>);
	} catch (error) {
		if (isFileNotFound(error)) {
			return undefined;
		}

		throw error;
	}
}
