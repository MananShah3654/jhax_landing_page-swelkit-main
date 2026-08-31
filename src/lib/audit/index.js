/**
 * Client-side audit orchestrator — replaces the old POST /api/audit backend route.
 * Runs entirely in the browser: fetches place facts from the active provider, then
 * computes the heuristics locally. Returns the EXACT same object shape the backend
 * used to return, so FreeAudit's buildReportFromApi() is unchanged.
 *
 * Errors are thrown as Error objects carrying `.status` (400/404/502) so the
 * component's existing status-based error messages behave identically to before.
 */
import { getProvider, PlaceNotFound, DataSourceError } from './providers.js';
import { resolvePlace, detailForCandidate } from './resolvePlace.js';
import { normalizeMapsLink, parseLongMapsUrl } from './mapsLink.js';
import { buildSubScores } from './subscores.js';
import { buildRanking, NEARBY_RADIUS_M } from './competitors.js';
import {
	estimateHealthScore,
	estimateMoneyLostWeekly,
	healthLabel,
	BENCHMARK_RATING,
	REVENUE_PER_STAR
} from './heuristics.js';

/** Reproduce Python's str(float) for one-decimal ratings (4.0 -> "4.0", 3.2 -> "3.2"). */
function pyFloatStr(x) {
	return Number.isInteger(x) ? x.toFixed(1) : String(x);
}

/** @param {number} status @param {string} message */
function httpErr(status, message) {
	const e = /** @type {Error & { status?: number }} */ (new Error(message));
	e.status = status;
	return e;
}

/** Where the short-link resolver lives — Vite middleware in dev, Cloud Function in prod. */
const RESOLVER_ENDPOINT = '/api/resolve-maps-link';
const RESOLVER_TIMEOUT_MS = 15000;

/**
 * Turn a Maps link into { name, city } from the browser.
 *
 * Long links (google.com/maps/place/…) carry the place name in the URL, so they are
 * parsed offline — no round trip, works even if the function is down. Short links
 * (maps.app.goo.gl/…) are opaque redirects whose target sends no CORS headers, so
 * they must go through the server resolver.
 *
 * @param {string} link
 * @returns {Promise<{ name: string, city: string }>}
 */
async function resolveMapsLinkInBrowser(link) {
	const local = parseLongMapsUrl(link);
	if (local?.name) return local;

	let resp;
	try {
		const url = `${RESOLVER_ENDPOINT}?url=${encodeURIComponent(normalizeMapsLink(link))}`;
		resp = await fetch(url, { signal: AbortSignal.timeout(RESOLVER_TIMEOUT_MS) });
	} catch {
		throw httpErr(503, 'Maps link resolver is unreachable');
	}

	// If the resolver is not deployed, Firebase Hosting's SPA rewrite answers with
	// index.html and a 200 — so trust the content type, not the status code.
	const isJson = (resp.headers.get('content-type') || '').includes('application/json');
	if (!isJson) throw httpErr(503, 'Maps link resolver is not deployed');

	let data;
	try {
		data = await resp.json();
	} catch {
		throw httpErr(502, 'Maps link resolver returned invalid JSON');
	}

	if (!resp.ok) throw httpErr(resp.status, data?.error || 'Could not read that Maps link');
	if (!data?.name) throw httpErr(404, 'That Maps link does not name a place');

	return { name: String(data.name), city: String(data.city || '') };
}

/** Server-side findings generator (holds the Gemini key). */
const FINDINGS_ENDPOINT = '/api/audit-findings';
const FINDINGS_TIMEOUT_MS = 45000;

/**
 * Ask the server for grounded findings about this place.
 *
 * Every finding it returns has already been verified against the place data on the
 * server — see verifyFindings() in src/lib/server/auditFindings.js. Failures here are
 * non-fatal by design: the teaser has already rendered the place and the scores, so a
 * findings outage degrades the panel rather than the page.
 *
 * @param {object} place
 * @returns {Promise<Array<object>>}
 */
async function fetchFindings(place, subScores, signedUp) {
	let resp;
	try {
		resp = await fetch(FINDINGS_ENDPOINT, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			// Sub-scores go UP so the server can stamp their teaser_visible too — it is
			// the single place the free/paid line is drawn, for both lists.
			body: JSON.stringify({ place, sub_scores: subScores, signed_up: signedUp === true }),
			signal: AbortSignal.timeout(FINDINGS_TIMEOUT_MS)
		});
	} catch {
		throw httpErr(503, 'Findings service is unreachable');
	}

	// Undeployed function => Firebase's SPA rewrite answers 200 with index.html.
	const isJson = (resp.headers.get('content-type') || '').includes('application/json');
	if (!isJson) throw httpErr(503, 'Findings service is not deployed');

	let data;
	try {
		data = await resp.json();
	} catch {
		throw httpErr(502, 'Findings service returned invalid JSON');
	}
	if (!resp.ok) {
		// The server still returns stamped sub-scores on failure, so the breakdown can
		// render even when the prose could not be generated. An EMPTY array is not
		// that — it means the server never got far enough to stamp anything, and
		// passing it on would replace the locally computed scores with nothing.
		const err = httpErr(resp.status, data?.error || 'Could not generate findings');
		err.subScores = Array.isArray(data?.sub_scores) && data.sub_scores.length ? data.sub_scores : null;
		throw err;
	}

	return {
		findings: Array.isArray(data?.findings) ? data.findings : [],
		subScores: Array.isArray(data?.sub_scores) ? data.sub_scores : [],
		totalFindings: typeof data?.total_findings === 'number' ? data.total_findings : 0
	};
}

/**
 * Re-request the teaser with signup asserted, to get back what was withheld.
 *
 * Locked detail is REDACTED server-side rather than hidden in CSS, so once someone
 * signs up the browser genuinely does not have that text and has to ask again. That
 * is the cost of not shipping locked content to the DOM, and it is deliberate.
 *
 * @param {object} place the raw provider place object from wave 1
 * @returns {Promise<{ findings: Array<object>, subScores: Array<object>, totalFindings: number }>}
 */
export async function unlockAudit(place) {
	// Sub-scores are RECOMPUTED from the place, never taken from the caller.
	//
	// The teaser redacts locked sub-scores to `value: null` before they reach the
	// browser, so the client's copy of them is lossy by design. Passing those back
	// here would have the server stamp them visible with their numbers already gone —
	// four rows that say "Google didn't return this data" for data Google did return.
	// The place object still holds everything they are derived from, so we rebuild.
	return fetchFindings(place, buildSubScores(place), true);
}

/**
 * Where this place stands against the restaurants around it.
 *
 * Both halves can decline: no coordinates means no search, and buildRanking refuses
 * whenever the neighbourhood is too thin to rank honestly. Either way the answer is
 * a value the caller can render (or hide) — never an exception.
 *
 * @param {object} place normalized provider output
 * @returns {Promise<{ ok: boolean, reason?: string }>}
 */
async function fetchLocalRanking(place) {
	if (!place?.location) return { ok: false, reason: 'no_location' };

	const rivals = await getProvider().nearby(place.location, {
		radiusM: NEARBY_RADIUS_M,
		primaryType: place.primary_type
	});

	return buildRanking(place, rivals, { radiusM: NEARBY_RADIUS_M });
}

/** Shape the estimate block exactly as the former /api/audit response did. */
function buildEstimated(rating, reviewCount) {
	const health = estimateHealthScore(rating, reviewCount);
	const moneyLost = estimateMoneyLostWeekly(rating, reviewCount);
	return {
		estimated: true,
		health_score: health,
		health_label: healthLabel(health),
		money_lost_weekly: moneyLost,
		basis:
			`Estimated from rating (${rating !== null ? pyFloatStr(rating) : 'n/a'}\u2605) and ` +
			`${reviewCount !== null ? reviewCount : 0} reviews. ` +
			`Benchmark ${BENCHMARK_RATING}\u2605, ~${Math.trunc(REVENUE_PER_STAR * 100)}% weekly revenue per star.`
	};
}

/**
 * Step one of an audit: work out WHICH place is being audited.
 *
 * Split out of runAudit because the answer may be "I don't know — ask the user".
 * That is a screen, not an exception, so it has to come back as a value the caller
 * can render rather than a thrown error.
 *
 * A Maps link is resolved to a name/city first and then searched like anything
 * else: the link resolver only recovers the place NAME from the URL, so a link to
 * one branch of a chain can still land on an ambiguous search.
 *
 * @param {{ name?: string, city?: string, mapsLink?: string }} input
 * @returns {Promise<{ status: 'ok'|'disambiguate'|'not_found', candidate?: object, candidates?: object[], query?: object, viaLink: boolean, rawInput: string }>}
 */
export async function resolveAuditTarget({ name, city, mapsLink }) {
	const link = String(mapsLink ?? '').trim();
	const viaLink = Boolean(link);
	// What the USER actually typed — the analytics payload for a failed resolution
	// wants this verbatim, not the cleaned-up derivative we search with.
	const rawInput = viaLink ? link : [String(name ?? '').trim(), String(city ?? '').trim()].filter(Boolean).join(', ');

	let cleanName = String(name ?? '').trim();
	let cleanCity = String(city ?? '').trim();

	if (viaLink) {
		const resolved = await resolveMapsLinkInBrowser(link);
		cleanName = resolved.name;
		cleanCity = resolved.city || '';
	}

	if (!cleanName) throw httpErr(400, 'Restaurant name is required');

	let result;
	try {
		result = await resolvePlace({ name: cleanName, city: cleanCity });
	} catch (exc) {
		// A provider that cannot answer is a 502 — distinct from "answered, found none".
		if (exc instanceof DataSourceError) throw httpErr(502, exc.message || 'Place lookup failed');
		throw exc;
	}

	return { ...result, viaLink, rawInput };
}

/**
 * Run an audit, emitting each piece THE MOMENT it is ready instead of resolving once
 * at the end. The teaser renders in three waves:
 *
 *   1. `place`    — name, address, photo. Available as soon as Places answers (~0.8s).
 *   2. `scores`   — overall health + the four sub-scores. Computed locally, so this
 *                   lands in the same tick as `place`; it is a separate stage because
 *                   the UI animates them in independently.
 *   3. `competitors` — where this place ranks among nearby restaurants. One extra
 *                   Places call, started as soon as `place` is known and raced
 *                   against the findings; it usually wins.
 *   4. `findings` — the grounded prose. Needs a server round-trip to Gemini, so it
 *                   arrives seconds later and must never hold up the waves above.
 *
 * When `candidate` is supplied (from resolveAuditTarget, or from the user tapping a
 * disambiguation card) resolution is already done and is skipped entirely.
 * Otherwise `mapsLink` WINS over name/city: the link resolves to a { name, city }
 * pair first, then the normal lookup runs on that.
 *
 * @param {{ name?: string, city?: string, mapsLink?: string, candidate?: object, signedUp?: boolean }} input
 * @param {(event: { stage: string, [k: string]: any }) => void} [onStage]
 * @returns {Promise<object>} the complete result, same shape the old runAudit returned
 */
export async function runAudit({ name, city, mapsLink, candidate, signedUp = false }, onStage = () => {}) {
	let place;

	try {
		if (candidate) {
			// Already resolved — by resolveAuditTarget's confident match, or by the user
			// picking a card. Skip the search entirely and go straight to the detail.
			place = await detailForCandidate(candidate);
		} else {
			// Legacy single-shot path: resolve and take the top result. Kept so callers
			// that never present a picker still work; the UI goes through
			// resolveAuditTarget instead, which will not pick for you.
			let cleanName = String(name ?? '').trim();
			let cleanCity = String(city ?? '');

			if (mapsLink && String(mapsLink).trim()) {
				const resolved = await resolveMapsLinkInBrowser(String(mapsLink).trim());
				cleanName = resolved.name;
				cleanCity = resolved.city || '';
			}

			if (!cleanName) throw httpErr(400, 'Restaurant name is required');
			place = await getProvider().fetch(cleanName, cleanCity);
		}
	} catch (exc) {
		if (exc instanceof PlaceNotFound) throw httpErr(404, 'Restaurant not found');
		if (exc instanceof DataSourceError) throw httpErr(502, exc.message || 'Place lookup failed');
		throw exc;
	}

	// --- Wave 1: who this is -------------------------------------------------
	onStage({ stage: 'place', place });

	// --- Wave 3, started early: the neighbourhood ----------------------------
	// Fired here rather than in sequence because it needs nothing but the place, and
	// a Nearby Search answers in well under a second — while the findings call is off
	// waiting on Gemini for several. Emitting from INSIDE the promise means the panel
	// paints the moment it lands instead of queueing behind the prose.
	const rankingPromise = (async () => {
		let ranking;
		try {
			ranking = await fetchLocalRanking(place);
		} catch {
			// Never fatal. The audit is complete without it; the panel just stays away.
			ranking = { ok: false, reason: 'lookup_failed' };
		}
		onStage({ stage: 'competitors', ranking });
		return ranking;
	})();

	// --- Wave 2: the numbers -------------------------------------------------
	const rating = place.rating ?? null;
	const reviewCount = place.review_count ?? null;
	const estimated = buildEstimated(rating, reviewCount);
	const subScores = buildSubScores(place);
	onStage({ stage: 'scores', estimated, sub_scores: subScores });

	// --- Wave 3: the prose, and the unlock flags for BOTH lists --------------
	// Sub-score VALUES were already emitted above so the breakdown paints early; their
	// teaser_visible flags arrive here. The client treats a missing flag as locked, so
	// the intermediate state fails closed rather than briefly leaking a locked number.
	let findings = [];
	let stampedSubScores = null;
	let totalFindings = 0;
	let findingsError = null;
	try {
		const res = await fetchFindings(place, subScores, signedUp);
		findings = res.findings;
		stampedSubScores = res.subScores;
		totalFindings = res.totalFindings;
	} catch (exc) {
		findingsError = /** @type {Error & { status?: number, subScores?: any }} */ (exc);
		if (findingsError.subScores) stampedSubScores = findingsError.subScores;
	}
	onStage({
		stage: 'findings',
		findings,
		sub_scores: stampedSubScores,
		total_findings: totalFindings,
		error: findingsError
	});

	const ranking = await rankingPromise;

	return {
		found: true,
		data_source: place.data_source || 'estimated',
		place: {
			name: place.name ?? null,
			address: place.address ?? null,
			rating,
			review_count: reviewCount,
			opening_hours: place.opening_hours || { open_now: null, weekday_text: [] },
			top_reviews: place.top_reviews || [],
			photo_url: place.photo_url ?? null,
			website: place.website ?? null
		},
		estimated,
		sub_scores: stampedSubScores || subScores,
		// Only a usable ranking travels; a refusal is not something to render.
		competitors: ranking.ok ? ranking : null,
		findings,
		total_findings: totalFindings,
		findings_error: findingsError ? findingsError.message : null
	};
}
