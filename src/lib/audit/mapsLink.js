/**
 * Google Maps link parsing — the ONE source of truth, shared by three callers:
 *   - the browser (fast path: long links carry the place name in the URL itself)
 *   - the Vite dev middleware (vite.config.js)
 *   - the deployed Cloud Function (functions/, via scripts/sync-functions-shared.mjs)
 *
 * Keep this file dependency-free and framework-free — no `$env`, no SvelteKit
 * imports — or the copy that ships to Cloud Functions stops working.
 *
 * Two link shapes reach us:
 *   long   https://www.google.com/maps/place/Joe's+Pizza/@40.73,-74.00,17z/data=…
 *   short  https://maps.app.goo.gl/aBcD1234
 *
 * Long links parse offline. Short links are opaque redirects whose target sends no
 * CORS headers, so only the server can follow them — see src/lib/server/resolveMapsLink.js.
 */

/** Longest link we will look at. Real Maps URLs run ~200–800 chars. */
export const MAPS_LINK_MAX = 2048;

// Exactly the two shapes the spec accepts: maps.app.goo.gl/* and google.com/maps/*.
// (A `google.co.in/maps/...` paste is REJECTED — see README note if that changes.)
const SHORT_LINK_RE = /^https?:\/\/maps\.app\.goo\.gl\/\S+$/i;
const LONG_LINK_RE = /^https?:\/\/(?:www\.)?google\.com\/maps(?:\/\S*|\?\S*)$/i;

/** Users paste "maps.app.goo.gl/x" as often as the full URL — treat both as valid. */
export function normalizeMapsLink(raw) {
	const value = String(raw ?? '').trim();
	if (!value) return '';
	return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

export function isShortMapsLink(raw) {
	return SHORT_LINK_RE.test(normalizeMapsLink(raw));
}

export function isLongMapsLink(raw) {
	return LONG_LINK_RE.test(normalizeMapsLink(raw));
}

export function isMapsLink(raw) {
	return isShortMapsLink(raw) || isLongMapsLink(raw);
}

/**
 * Split a Maps place label into a name and a best-effort city.
 *
 * Labels arrive in two flavours depending on how the user copied the link:
 *   "Joe's Pizza"                                        (share sheet)
 *   "Katz's Delicatessen, 205 E Houston St, New York, NY 10002"   (URL bar)
 *
 * The city is a HEURISTIC, not a parse — it only has to be good enough to sharpen
 * a text search, and a wrong guess still finds the place via the name. Rules:
 * a trailing digit-free segment in a long address is the country, and any trailing
 * segment containing digits is a postcode / "NY 10002", never a city.
 */
function splitNameAndCity(label) {
	const parts = String(label)
		.split(',')
		.map((s) => s.trim())
		.filter(Boolean);
	if (parts.length === 0) return null;

	const name = parts[0];
	const rest = parts.slice(1);

	// "…, Mumbai, Maharashtra 400001, India" -> drop "India"
	if (rest.length >= 3 && !/\d/.test(rest[rest.length - 1])) rest.pop();
	// "…, New York, NY 10002" -> drop "NY 10002"
	while (rest.length > 1 && /\d/.test(rest[rest.length - 1])) rest.pop();

	let city = rest.length ? rest[rest.length - 1] : '';
	// A city that still contains digits is a postcode we failed to strip — drop it
	// rather than feed junk into the search.
	if (/\d/.test(city) || city.length > 60) city = '';

	return { name, city };
}

function safeDecode(segment) {
	try {
		return decodeURIComponent(segment.replace(/\+/g, ' '));
	} catch {
		// Malformed %-escapes: fall back to the raw segment rather than throwing.
		return segment.replace(/\+/g, ' ');
	}
}

/** A bare "40.7,-74.0" query names a point on the map, not a restaurant. */
const LATLNG_RE = /^-?\d+(?:\.\d+)?\s*,\s*-?\d+(?:\.\d+)?$/;

/**
 * Pull { name, city } out of a LONG Maps URL without any network call.
 * Returns null when the URL carries no usable place name (e.g. a pure coordinate link).
 * @param {string} raw
 * @returns {{ name: string, city: string } | null}
 */
export function parseLongMapsUrl(raw) {
	let url;
	try {
		url = new URL(normalizeMapsLink(raw));
	} catch {
		return null;
	}

	// /maps/place/<Label>/@lat,lng,17z/…  — the common share + URL-bar shape.
	const place = url.pathname.match(/\/maps\/place\/([^/]+)/);
	if (place) {
		const label = safeDecode(place[1]).trim();
		if (label && !label.startsWith('@') && !LATLNG_RE.test(label)) {
			const split = splitNameAndCity(label);
			if (split?.name) return split;
		}
	}

	// /maps/search/<Label> and /maps/search/?api=1&query=… / /maps?q=…
	const search = url.pathname.match(/\/maps\/search\/([^/@?]+)/);
	if (search) {
		const label = safeDecode(search[1]).trim();
		if (label && !LATLNG_RE.test(label)) {
			const split = splitNameAndCity(label);
			if (split?.name) return split;
		}
	}

	const q = (url.searchParams.get('query') || url.searchParams.get('q') || '').trim();
	if (q && !LATLNG_RE.test(q)) {
		const split = splitNameAndCity(q);
		if (split?.name) return split;
	}

	return null;
}
