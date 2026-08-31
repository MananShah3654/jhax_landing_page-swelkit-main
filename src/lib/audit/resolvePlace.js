/**
 * Place resolution — the step that decides WHICH restaurant an audit is about.
 *
 * The old path asked Google for one result and audited it, so an operations manager
 * with four locations called "Toit" got a report on whichever one Google ranked
 * first, with nothing on screen admitting a choice had been made. This module makes
 * that choice explicit: it returns candidates and lets the caller decide, and only
 * auto-selects when the match is genuinely unambiguous.
 *
 * The return value is the resolve-place contract:
 *
 *   { status: 'ok',            candidate }              // confident single match
 *   { status: 'disambiguate',  candidates, query }      // 2..5 plausible matches
 *   { status: 'not_found',     query }                  // nothing matched
 *
 * Candidates are plain JSON — name, address, rating, review count, thumbnail — so
 * this is a drop-in for a POST /api/resolve-place that returns the same body. The
 * live provider objects they came from are held in a module-private map keyed by
 * place id (see detailForCandidate), never on the candidate itself: they must not
 * be deep-proxied by Svelte's $state, and they are not part of the contract.
 */
import { getProvider, DataSourceError } from './providers.js';

/** Never show more than this many cards — five is the AC's cap and a sane one. */
export const MAX_CANDIDATES = 5;

/**
 * id -> live provider place object, for the candidate the user eventually taps.
 * Replaced wholesale on every resolve, so it never grows past one search.
 * @type {Map<string, any>}
 */
let liveRefs = new Map();

/**
 * Fold a place name down to something comparable: lowercase, accent-stripped,
 * punctuation-free. "Toit — Brewpub" and "toit brewpub" compare equal; "Toit" and
 * "Toit Brewpub" deliberately do not.
 * @param {string} s
 */
function normalizeName(s) {
	return String(s ?? '')
		.toLowerCase()
		.normalize('NFKD')
		.replace(/[\u0300-\u036f]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/**
 * Is the top candidate a confident enough match to skip the picker?
 *
 * The rule, deliberately conservative — when in doubt we ask:
 *   1. Google returned exactly one result, OR
 *   2. the top result's name matches what was typed EXACTLY (after normalising),
 *      and no other candidate shares that name.
 *
 * Rule 2's second half is what protects the multi-location case: four branches all
 * genuinely called "Toit" all match exactly, so none of them wins by default.
 *
 * Note there is no confidence score to threshold against — the Places API does not
 * return one — so this rule IS the threshold.
 *
 * @param {Array<{name: string}>} candidates
 * @param {string} typedName
 */
function isConfidentMatch(candidates, typedName) {
	if (candidates.length === 0) return false;
	if (candidates.length === 1) return true;

	const target = normalizeName(typedName);
	if (!target) return false; // nothing to compare against — ask.

	const exactMatches = candidates.filter((c) => normalizeName(c.name) === target);
	return exactMatches.length === 1 && normalizeName(candidates[0].name) === target;
}

/**
 * Provider place -> candidate card data. Everything the card renders, nothing else.
 * @param {any} place
 */
function toCandidate(place) {
	return {
		id: String(place?.id ?? ''),
		name: place?.displayName || 'Unnamed place',
		address: place?.formattedAddress ?? null,
		rating: typeof place?.rating === 'number' ? place.rating : null,
		review_count: typeof place?.userRatingCount === 'number' ? place.userRatingCount : null,
		photo_url: place?.__thumbUrl ?? null
	};
}

/**
 * Resolve a name/city into one place, several, or none.
 *
 * Throws only on genuine failures (no API key, provider refusal, network). "Nothing
 * matched" is a RESULT — `status: 'not_found'` — because the UI owes the user a
 * different screen for it than for a broken lookup.
 *
 * @param {{ name: string, city?: string }} input
 * @returns {Promise<{ status: 'ok', candidate: object } | { status: 'disambiguate', candidates: object[], query: object } | { status: 'not_found', query: object }>}
 */
export async function resolvePlace({ name, city = '' }) {
	const cleanName = String(name ?? '').trim();
	const cleanCity = String(city ?? '').trim();
	const query = { name: cleanName, city: cleanCity };

	const provider = getProvider();
	const places = await provider.search(cleanName, cleanCity, MAX_CANDIDATES);

	liveRefs = new Map();
	const candidates = [];
	for (const place of (places || []).slice(0, MAX_CANDIDATES)) {
		// Thumbnail is resolved here, once, while we still hold the live object.
		// Smaller box than the report header's — these are 96px cards.
		try {
			place.__thumbUrl = (place.photos || [])[0]?.getURI?.({ maxWidth: 200, maxHeight: 200 }) ?? null;
		} catch {
			place.__thumbUrl = null; // a card without a photo is fine; a crash is not
		}
		const candidate = toCandidate(place);
		if (!candidate.id) continue; // without an id we could never fetch its detail
		liveRefs.set(candidate.id, place);
		candidates.push(candidate);
	}

	if (candidates.length === 0) return { status: 'not_found', query };
	if (isConfidentMatch(candidates, cleanName)) return { status: 'ok', candidate: candidates[0] };
	return { status: 'disambiguate', candidates, query };
}

/**
 * Load the full audit inputs for a candidate the user chose (or that resolved
 * confidently). Looks the live provider object back up by id.
 *
 * @param {{ id: string, name?: string }} candidate
 * @returns {Promise<object>} the normalized place object the heuristics consume
 */
export async function detailForCandidate(candidate) {
	const ref = liveRefs.get(String(candidate?.id ?? ''));
	if (!ref) {
		// Only reachable if a candidate outlived its search (e.g. a stale click after
		// a new lookup replaced the map). Re-running the search is the honest fix.
		throw new DataSourceError('That result expired — please run the search again.');
	}
	return getProvider().detail(ref, candidate?.name || '');
}
