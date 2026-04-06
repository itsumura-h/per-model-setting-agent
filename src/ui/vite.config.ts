import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite'
import preact from '@preact/preset-vite';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const uiDir = dirname(fileURLToPath(import.meta.url));
const workspaceRoot = resolve(uiDir, '..', '..');

// https://vitejs.dev/config/
export default defineConfig({
	plugins: [
		preact(),
		tailwindcss(),
	],
	base: './',
	server: {
		fs: {
			allow: [workspaceRoot],
		},
	},
});
