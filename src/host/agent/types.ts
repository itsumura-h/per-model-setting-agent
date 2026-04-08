export type AgentFileEdit = {
	relativePath: string;
	content: string;
};

export type AgentFileRead = {
	/** workspace 相対パスまたは workspace 内の絶対パス */
	filePath: string;
};

export type AgentListFiles = {
	pattern?: string;
	maxDepth?: number;
};

export type AgentShellExec = {
	command: string;
	cwd?: string;
};

/** ツール ID（例: file-edit-tool の id）→ そのツールの parseResponse 結果の配列 */
export type AgentToolOutputs = Record<string, unknown[]>;

export type AgentResult = {
	assistantMessage: string;
	toolOutputs: AgentToolOutputs;
	rawResponse: string;
};

export type AgentStreamEvent =
	| {
			type: 'start';
			requestId?: string;
			providerName: string;
			modelName: string;
			prompt: string;
			timestamp: string;
	  }
	| {
			type: 'delta';
			delta: string;
			accumulatedText: string;
			sequenceNumber?: number;
			timestamp: string;
	  }
	| {
			type: 'complete';
			text: string;
			toolOutputs: AgentToolOutputs;
			rawResponse: string;
			requestId?: string;
			timestamp: string;
	  }
	| {
			type: 'error';
			errorMessage: string;
			requestId?: string;
			retryable: boolean;
			timestamp: string;
	  };

export type AgentStreamObserver = {
	onEvent?: (event: AgentStreamEvent) => void | Promise<void>;
	onStart?: (event: Extract<AgentStreamEvent, { type: 'start' }>) => void | Promise<void>;
	onDelta?: (event: Extract<AgentStreamEvent, { type: 'delta' }>) => void | Promise<void>;
	onComplete?: (event: Extract<AgentStreamEvent, { type: 'complete' }>) => void | Promise<void>;
	onError?: (event: Extract<AgentStreamEvent, { type: 'error' }>) => void | Promise<void>;
};
