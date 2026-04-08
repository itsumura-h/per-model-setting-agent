import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import type { AgentResult } from './agent/types';

const LOG_FILE = path.join(os.homedir(), '.permosa', 'log.txt');

/**
 * デバッグ用: 送信プロンプトとモデル応答を ~/.permosa/log.txt に追記する。
 * 失敗しても Agent 実行は継続する。
 */
export async function appendPermosaAgentDebugLog(payload: {
	phase: string;
	requestId: string;
	providerName?: string;
	modelName?: string;
	modelId?: string;
	systemPrompt: string;
	userPrompt: string;
	result: AgentResult;
}): Promise<void> {
	try {
		await fs.mkdir(path.dirname(LOG_FILE), { recursive: true });
		const lines = [
			'================================================================================',
			`timestamp: ${new Date().toISOString()}`,
			`phase: ${payload.phase}`,
			`requestId: ${payload.requestId}`,
			...(payload.providerName ? [`provider: ${payload.providerName}`] : []),
			...(payload.modelName ? [`modelName: ${payload.modelName}`] : []),
			...(payload.modelId ? [`modelId: ${payload.modelId}`] : []),
			'',
			'--- systemPrompt ---',
			payload.systemPrompt,
			'',
			'--- userPrompt (送信入力) ---',
			payload.userPrompt,
			'',
			'--- rawResponse (モデル生テキスト全文) ---',
			payload.result.rawResponse,
			'',
			'--- assistantMessage (抽出後) ---',
			payload.result.assistantMessage,
			'',
			'--- toolOutputs (JSON) ---',
			JSON.stringify(payload.result.toolOutputs, null, 2),
			'',
			'',
		];
		await fs.appendFile(LOG_FILE, lines.join('\n'), 'utf8');
	} catch {
		// デバッグログの失敗で Agent を止めない
	}
}
