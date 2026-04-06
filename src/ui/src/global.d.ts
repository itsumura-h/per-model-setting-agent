declare global {
	interface Window {
		acquireVsCodeApi?: () => import('./types').VsCodeApi;
	}
}

export {};
