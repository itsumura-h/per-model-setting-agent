export type ToolDefinition = {
	/** ツールの一意識別子（例: "file-edit", "file-read"） */
	id: string;

	/** AI に渡すシステムプロンプト断片（ツールの使い方の説明） */
	promptInstructions: string[];

	/** AI にツール使用を強制するときの追加指示 */
	promptDirective: string[];

	/** AI がこのツールを使うリクエストかどうかを判定する */
	matchesRequest: (prompt: string) => boolean;

	/** 安全注意事項（プロンプトに埋め込む） */
	safetyNotice: {
		title: string;
		items: string[];
	};

	/** AI のレスポンス JSON からこのツールの実行指示を抽出する */
	parseResponse: (parsed: Record<string, unknown>) => unknown[];

	/** レスポンスが不足していた場合のリトライ用追加指示 */
	retryDirective: string[];
};
