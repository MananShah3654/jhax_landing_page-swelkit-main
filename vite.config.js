import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig, loadEnv } from 'vite';
import { handleResolveRequest } from './src/lib/server/resolveMapsLink.js';
import { handleFindingsRequest } from './src/lib/server/auditFindings.js';

/**
 * Dev-only stand-in for the deployed Cloud Function.
 *
 * The app is static (adapter-static), so it has no server routes of its own — a
 * SvelteKit `+server.js` here would simply fail the build. Instead the ONE resolver
 * implementation (src/lib/server/resolveMapsLink.js) is mounted two ways:
 *
 *   npm run dev  -> this middleware
 *   deployed     -> functions/index.js, same /api/resolve-maps-link path via the
 *                   hosting rewrite in firebase.json
 *
 * `apply: 'serve'` keeps it out of the production build entirely.
 */
function mapsLinkResolverDev() {
	return {
		name: 'jhax-maps-link-resolver-dev',
		apply: 'serve',
		configureServer(server) {
			const json = (res, status, body) => {
				res.statusCode = status;
				res.setHeader('content-type', 'application/json');
				res.end(JSON.stringify(body));
			};

			server.middlewares.use('/api/resolve-maps-link', async (req, res) => {
				const url = new URL(req.url || '', 'http://localhost');
				const { status, body } = await handleResolveRequest(url.searchParams.get('url'));
				json(res, status, body);
			});

			server.middlewares.use('/api/audit-findings', async (req, res) => {
				const chunks = [];
				for await (const c of req) chunks.push(c);
				let parsed;
				try {
					parsed = JSON.parse(Buffer.concat(chunks).toString('utf-8') || '{}');
				} catch {
					json(res, 400, { error: 'Invalid JSON body' });
					return;
				}
				const { status, body } = await handleFindingsRequest(parsed);
				json(res, status, body);
			});
		}
	};
}

/**
 * Make server-only keys in `.env` visible to the dev middleware above.
 *
 * Vite only inlines the PUBLIC_ and VITE_ prefixes into the CLIENT bundle; it
 * never populates `process.env`. The two handlers above run in Node and read `process.env`
 * directly (auditFindings needs GEMINI_API_KEY), so without this an operator
 * can put the key in `.env` alongside every other key in this project and get a
 * silent 503 telling them it is "not configured" — which it is, just not where
 * they looked. A real shell variable still wins, so CI and the Cloud Function
 * (whose secret arrives that way) are unaffected.
 */
function loadServerEnv(mode) {
	const fileEnv = loadEnv(mode, process.cwd(), '');
	for (const key of ['GEMINI_API_KEY', 'GOOGLE_API_KEY', 'GEMINI_MODEL']) {
		if (!process.env[key] && fileEnv[key]) process.env[key] = fileEnv[key];
	}
}

export default defineConfig(({ mode }) => {
	loadServerEnv(mode);
	return { plugins: [sveltekit(), mapsLinkResolverDev()] };
});
