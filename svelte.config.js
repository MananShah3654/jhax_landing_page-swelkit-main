import adapter from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		// Fully static SPA — no server. `fallback` serves the app shell for the
		// single client-rendered route (ssr is disabled in +layout.js).
		adapter: adapter({ fallback: 'index.html' }),
		alias: {
			'@': 'src/lib'
		}
	}
};

export default config;
