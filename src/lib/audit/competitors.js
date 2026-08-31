/**
 * Local rank — where this restaurant sits among the places a diner would pick instead.
 *
 * This is the one part of the teaser that is not about the restaurant in isolation.
 * An owner can argue with a score; they cannot argue with the fact that the place two
 * streets over is rated higher than them.
 *
 * Everything here is REAL Google data or arithmetic on it. There is no modelled
 * number, no assumed market, and no invented competitor — in keeping with the rest of
 * the audit, when the data cannot support a rank this module REFUSES to produce one
 * rather than producing a weak one. Refusal is a value (`{ ok: false, reason }`), not
 * an exception, because "we could not compare you" is a state the UI hides, not an
 * error it reports.
 *
 * Pure module (no env / platform / network imports) so it runs in the browser and
 * under a test harness. The Places call that feeds it lives in providers.js.
 */

/** How far out a diner realistically substitutes. */
export const NEARBY_RADIUS_M = 1500;

/**
 * A competitor needs this many reviews before it is allowed into the comparison.
 *
 * Without a floor the ranking is decided by noise: a place with four reviews and a
 * 5.0 average would outrank a genuinely excellent restaurant with nine hundred, and
 * the owner reading it would be right to call the whole audit worthless. The floor
 * applies to COMPETITORS only — the subject is always in its own ranking — which is
 * why the basis line states the rule outright instead of hiding it.
 */
export const MIN_COMPETITOR_REVIEWS = 20;

/** Below this many rivals the "rank" is a coin toss, so we decline to show one. */
export const MIN_COMPARABLE_RIVALS = 2;

/** @param {unknown} n */
const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

/** One decimal, the precision Google publishes ratings at. */
const round1 = (n) => Math.round(n * 10) / 10;

/** Collapse case, punctuation and spacing so "Joe's Pizza" == "joes pizza". */
function normalizeName(s) {
	return String(s ?? '')
		.toLowerCase()
		.replace(/[’'`]/g, '')
		.replace(/[^a-z0-9]+/g, ' ')
		.trim();
}

/**
 * Is this nearby result actually the restaurant being audited?
 *
 * Place ids are authoritative when both sides have one. Falling back to the name is
 * deliberate: if the subject came through a path that left it without an id, matching
 * on name keeps the restaurant from being ranked against ITSELF — an off-by-one that
 * would read as "#2 of 12" for a place that is actually top of its street.
 */
function isSubject(candidate, subject) {
	if (candidate?.id && subject?.id) return candidate.id === subject.id;
	const a = normalizeName(candidate?.name);
	return a !== '' && a === normalizeName(subject?.name);
}

/** Strip a ranked entry down to what the UI may show. */
const publicEntry = (e) => ({
	name: e.name,
	rating: e.rating,
	review_count: e.review_count,
	is_subject: e.is_subject === true
});

/**
 * Rank the subject against its neighbours.
 *
 * Ordering is by rating, then by review count — two restaurants both on 4.3 are not
 * equal when one earned it over 800 reviews and the other over 40. Ties broken last by
 * name so the same inputs always produce the same list.
 *
 * @param {{ id?: string|null, name?: string|null, rating?: number|null, review_count?: number|null }} subject
 * @param {Array<{ id?: string|null, name?: string|null, rating?: number|null, review_count?: number|null }>} nearby
 * @param {{ radiusM?: number, minReviews?: number }} [opts]
 * @returns {{ ok: false, reason: string } | { ok: true, rank: number, total: number, ... }}
 */
export function buildRanking(subject, nearby, opts = {}) {
	const radiusM = opts.radiusM ?? NEARBY_RADIUS_M;
	const minReviews = opts.minReviews ?? MIN_COMPETITOR_REVIEWS;

	if (!isNum(subject?.rating)) {
		// No rating means no position on the only axis this ranks by.
		return { ok: false, reason: 'no_subject_rating' };
	}

	const seen = new Set();
	const rivals = [];
	for (const c of Array.isArray(nearby) ? nearby : []) {
		if (!isNum(c?.rating) || !isNum(c?.review_count)) continue;
		if (c.review_count < minReviews) continue;
		if (isSubject(c, subject)) continue;
		// Nearby search can return the same place twice across pages/types.
		const key = c.id || normalizeName(c.name);
		if (!key || seen.has(key)) continue;
		seen.add(key);
		rivals.push({
			id: c.id ?? null,
			name: String(c.name ?? '').trim() || 'Unnamed restaurant',
			rating: c.rating,
			review_count: c.review_count,
			is_subject: false
		});
	}

	if (rivals.length < MIN_COMPARABLE_RIVALS) {
		return { ok: false, reason: 'not_enough_rivals' };
	}

	const me = {
		id: subject.id ?? null,
		name: String(subject.name ?? '').trim() || 'Your restaurant',
		rating: subject.rating,
		review_count: isNum(subject.review_count) ? subject.review_count : 0,
		is_subject: true
	};

	const ranked = [...rivals, me].sort(
		(a, b) =>
			b.rating - a.rating ||
			b.review_count - a.review_count ||
			a.name.localeCompare(b.name)
	);

	const index = ranked.findIndex((e) => e.is_subject);
	const rank = index + 1;
	const total = ranked.length;
	const leader = ranked[0];
	const nextUp = index > 0 ? ranked[index - 1] : null;

	// Median of the whole comparison set, subject included — "the typical listing on
	// this street", which is the number an owner instinctively measures against.
	const ratings = ranked.map((e) => e.rating).sort((a, b) => a - b);
	const mid = Math.floor(ratings.length / 2);
	const median = round1(
		ratings.length % 2 ? ratings[mid] : (ratings[mid - 1] + ratings[mid]) / 2
	);

	return {
		ok: true,
		rank,
		total,
		radius_m: radiusM,
		min_reviews: minReviews,
		subject: publicEntry(me),
		leader: publicEntry(leader),
		next_up: nextUp ? publicEntry(nextUp) : null,
		/** How far the subject is off the place immediately above it, in stars. */
		gap_to_next: nextUp ? round1(nextUp.rating - me.rating) : null,
		/** ...and off the top of the street. */
		gap_to_leader: round1(leader.rating - me.rating),
		median_rating: median,
		/** True when the subject is beating the typical nearby listing. */
		above_median: me.rating > median,
		/** The full ordered board, so the UI can show the places above them by name. */
		board: ranked.map(publicEntry),
		// Says "most prominent" because that is what Nearby Search returns: up to 20
		// places ranked by prominence, not a census of the radius. Claiming to have
		// ranked them against every restaurant nearby would be a claim we cannot make.
		basis:
			`Ranked by Google rating against the ${rivals.length} most prominent nearby ` +
			`restaurant${rivals.length === 1 ? '' : 's'} within ${(radiusM / 1000).toFixed(1)} km ` +
			`that have ${minReviews}+ reviews.`
	};
}

/**
 * The rows worth showing from a full board: the top three, the place directly above
 * this restaurant, and this restaurant.
 *
 * A board of twenty listings is not a story. "Here is the top, here is who you are
 * chasing, here is you" is. `gap_before` marks where ranks were skipped, so a trimmed
 * list can never be misread as the complete neighbourhood.
 *
 * Lives here rather than in the component because the on-screen panel and the PDF
 * must show the SAME rows — a downloaded report that disagrees with the page the
 * owner just read is worse than no report.
 *
 * @param {{ board?: Array<object> } | null} ranking
 */
export function rankRows(ranking) {
	if (!ranking?.board?.length) return [];
	const all = ranking.board.map((e, i) => ({ ...e, rank: i + 1 }));
	const mine = all.findIndex((r) => r.is_subject);
	const keep = [...new Set([0, 1, 2, mine - 1, mine])]
		.filter((i) => i >= 0 && i < all.length)
		.sort((a, b) => a - b);
	return keep.map((i, n) => ({ ...all[i], gap_before: n > 0 && i - keep[n - 1] > 1 }));
}
