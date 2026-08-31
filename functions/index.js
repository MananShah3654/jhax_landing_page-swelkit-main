/**
 * The one server-side piece of an otherwise fully static site.
 *
 * A `maps.app.goo.gl/…` short link is an opaque redirect and its target sends no
 * CORS headers, so the browser cannot follow it. This function does, and returns
 * the { name, city } the audit search needs.
 *
 * The resolver logic itself is NOT written here — `shared/` is copied verbatim from
 * src/lib by scripts/sync-functions-shared.mjs (wired as a firebase.json predeploy),
 * so dev and prod run identical code.
 */
import { onRequest } from 'firebase-functions/v2/https';
import { handleResolveRequest } from './shared/server/resolveMapsLink.js';
import { handleFindingsRequest } from './shared/server/auditFindings.js';

export const resolveMapsLink = onRequest(
	{
		region: 'us-central1',
		memory: '256MiB',
		timeoutSeconds: 30,
		// Reached same-origin through the hosting rewrite, so no CORS headers needed.
		cors: false,
		maxInstances: 10
	},
	async (req, res) => {
		if (req.method !== 'GET') {
			res.status(405).json({ error: 'Method not allowed' });
			return;
		}

		const { status, body } = await handleResolveRequest(req.query?.url);

		// Short links are permanent, so a successful resolution is worth caching at
		// the CDN — it keeps repeat pastes of the same link off the function entirely.
		if (status === 200) res.set('cache-control', 'public, max-age=3600, s-maxage=86400');
		res.status(status).json(body);
	}
);

/**
 * Grounded teaser findings. Holds the Gemini key, so it can only run here — the
 * browser posts the place data it already fetched and gets back verified findings.
 *
 * `secrets` binds GEMINI_API_KEY from Secret Manager; set it once with:
 *   firebase functions:secrets:set GEMINI_API_KEY
 */
export const auditFindings = onRequest(
	{
		region: 'us-central1',
		memory: '512MiB',
		// Generous: an Opus call with adaptive thinking can take several seconds, and
		// the client streams this in last rather than blocking the rest of the teaser.
		timeoutSeconds: 60,
		cors: false,
		maxInstances: 10,
		secrets: ['GEMINI_API_KEY']
	},
	async (req, res) => {
		if (req.method !== 'POST') {
			res.status(405).json({ error: 'Method not allowed' });
			return;
		}
		const { status, body } = await handleFindingsRequest(req.body);
		res.status(status).json(body);
	}
);
