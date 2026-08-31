/**
 * Server-side Google Maps link resolver.
 *
 * WHY THIS EXISTS: a `maps.app.goo.gl/…` short link is an opaque redirect, and the
 * page it redirects to sends no CORS headers — so the browser can neither follow it
 * nor read it. Following the redirect has to happen off the browser. This module is
 * that code, and it runs in exactly two places:
 *
 *   dev   -> Vite middleware at /api/resolve-maps-link  (vite.config.js)
 *   prod  -> Firebase Cloud Function, same path via a hosting rewrite (functions/)
 *
 * Dependency-free and framework-free on purpose: `scripts/sync-functions-shared.mjs`
 * copies this file (and audit/mapsLink.js) verbatim into functions/shared/ at deploy
 * time, so there is one implementation rather than two that drift.
 */
import { isMapsLink, isShortMapsLink, normalizeMapsLink, parseLongMapsUrl } from '../audit/mapsLink.js';

const MAX_REDIRECTS = 5;
const REQUEST_TIMEOUT_MS = 8000;
/** Cap the HTML we read when the redirect target still hides the name. */
const MAX_HTML_BYTES = 256 * 1024;

// Google serves a very different page to an unknown agent; a normal desktop UA gets
// the real place page instead of a consent interstitial.
const BROWSER_UA =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** @param {number} status @param {string} message */
function httpErr(status, message) {
	const e = /** @type {Error & { status?: number }} */ (new Error(message));
	e.status = status;
	return e;
}

/**
 * Follow the short-link redirect chain by hand.
 * `redirect: 'manual'` keeps us in control of the hop count and lets us read the
 * final URL even when the last hop is a page we don't want to download.
 * @param {string} startUrl
 * @returns {Promise<string>} the URL the chain settles on
 */
async function followRedirects(startUrl) {
	let current = startUrl;

	for (let hop = 0; hop < MAX_REDIRECTS; hop++) {
		let resp;
		try {
			resp = await fetch(current, {
				method: 'GET',
				redirect: 'manual',
				headers: { 'user-agent': BROWSER_UA, accept: 'text/html,*/*' },
				signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
			});
		} catch (exc) {
			throw httpErr(502, `Could not reach Google Maps: ${exc}`);
		}

		const location = resp.headers.get('location');
		if (resp.status >= 300 && resp.status < 400 && location) {
			current = new URL(location, current).toString();
			continue;
		}
		if (resp.status >= 400) throw httpErr(404, `Google Maps returned ${resp.status} for that link`);
		return current;
	}

	throw httpErr(502, 'That link redirected too many times');
}

/**
 * Last resort: the redirect settled somewhere without a parseable /place/ path
 * (a consent wall, or a shortened link that lands on the map canvas). The place
 * name is still in the page's og:title / <title>.
 * @param {string} url
 * @returns {Promise<{ name: string, city: string } | null>}
 */
async function parseFromHtml(url) {
	let html;
	try {
		const resp = await fetch(url, {
			headers: { 'user-agent': BROWSER_UA, accept: 'text/html' },
			signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
		});
		if (!resp.ok) return null;
		html = (await resp.text()).slice(0, MAX_HTML_BYTES);
	} catch {
		return null;
	}

	const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
	const title = og?.[1] || html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1] || '';
	const label = title
		.replace(/\s*[-–|]\s*Google\s*Maps\s*$/i, '')
		.replace(/&amp;/g, '&')
		.trim();

	if (!label || /^google maps$/i.test(label)) return null;
	// og:title is "Name" or "Name, Street, City" — same shape parseLongMapsUrl feeds
	// splitNameAndCity, so route it through a synthetic /place/ URL for one code path.
	return parseLongMapsUrl(`https://www.google.com/maps/place/${encodeURIComponent(label)}/`);
}

/**
 * Turn any accepted Maps link into the { name, city } the audit search needs.
 * Throws an Error carrying `.status` (400 / 404 / 502) so callers can map it to a
 * message the same way the audit pipeline already does.
 *
 * @param {string} rawLink
 * @returns {Promise<{ name: string, city: string, resolvedUrl: string }>}
 */
export async function resolveMapsLink(rawLink) {
	const link = normalizeMapsLink(rawLink);
	if (!link) throw httpErr(400, 'No Maps link supplied');
	if (!isMapsLink(link)) throw httpErr(400, 'That is not a Google Maps link');

	// Long links already carry the name — no network call, no redirect to follow.
	if (!isShortMapsLink(link)) {
		const parsed = parseLongMapsUrl(link);
		if (parsed?.name) return { ...parsed, resolvedUrl: link };
		throw httpErr(404, 'That Maps link does not name a place');
	}

	const resolvedUrl = await followRedirects(link);

	const parsed = parseLongMapsUrl(resolvedUrl);
	if (parsed?.name) return { ...parsed, resolvedUrl };

	const fromHtml = await parseFromHtml(resolvedUrl);
	if (fromHtml?.name) return { ...fromHtml, resolvedUrl };

	throw httpErr(404, 'We could not read a restaurant out of that link');
}

/**
 * Framework-neutral request handler shared by the Vite dev middleware and the Cloud
 * Function, so both return byte-identical JSON.
 * @param {string | null | undefined} urlParam
 * @returns {Promise<{ status: number, body: object }>}
 */
export async function handleResolveRequest(urlParam) {
	if (!urlParam) return { status: 400, body: { error: 'Missing "url" query parameter' } };
	if (urlParam.length > 2048) return { status: 400, body: { error: 'That link is too long' } };

	try {
		const { name, city } = await resolveMapsLink(urlParam);
		return { status: 200, body: { name, city } };
	} catch (exc) {
		const status = /** @type {any} */ (exc)?.status ?? 502;
		return { status, body: { error: /** @type {Error} */ (exc).message } };
	}
}
