/**
 * Sub-scores — four 0..100 dimensions computed from Places data ONLY.
 *
 * Every one of these is derived from a field we actually received. Nothing here
 * estimates, models, or invents: if the data needed for a dimension is missing, the
 * sub-score is `null` and the UI shows it as unavailable rather than guessing.
 *
 * The OVERALL score is deliberately NOT recomputed from these — it stays
 * estimateHealthScore() in heuristics.js, which is locked to the original Python
 * backend by the parity harness. Sub-scores sit alongside it as a breakdown.
 *
 * Pure module (no env / platform imports) so it runs in the browser, in the Cloud
 * Function, and under a test harness.
 */
import { pyRound, BENCHMARK_RATING } from './heuristics.js';

/** A review older than this contributes nothing to Freshness. */
export const FRESHNESS_HORIZON_DAYS = 180;

const clamp01 = (n) => Math.max(0, Math.min(1, n));
const toPct = (n) => Math.trunc(pyRound(clamp01(n) * 100));

/**
 * Reputation — where the star rating sits on the 2.5★..5.0★ band.
 * 2.5★ (the floor Google effectively bottoms out at) scores 0; 5.0★ scores 100.
 * @param {number|null|undefined} rating
 */
export function reputationScore(rating) {
	if (typeof rating !== 'number' || !Number.isFinite(rating)) return null;
	return toPct((rating - 2.5) / 2.5);
}

/**
 * Visibility — public review volume, log-scaled because the difference between 10
 * and 100 reviews matters far more than 10,000 vs 10,090. 1,000 reviews = 100.
 * @param {number|null|undefined} reviewCount
 */
export function visibilityScore(reviewCount) {
	if (typeof reviewCount !== 'number' || !Number.isFinite(reviewCount)) return null;
	if (reviewCount < 0) return null;
	return toPct(Math.log10(reviewCount + 1) / Math.log10(1000));
}

/**
 * Freshness — how recently people have been reviewing you. Uses the NEWEST review
 * we were given: today = 100, FRESHNESS_HORIZON_DAYS old or older = 0.
 *
 * Places returns at most 5 reviews, and they are not guaranteed to be the newest
 * ones — so this is "the most recent review Google showed us", which is what the UI
 * must say too. Returns null when no review carries a usable timestamp.
 *
 * @param {Array<{ publish_time?: string|number|Date|null }>} reviews
 * @param {number} [nowMs] injectable clock, so this stays testable
 */
export function freshnessScore(reviews, nowMs = Date.now()) {
	if (!Array.isArray(reviews) || reviews.length === 0) return null;

	let newestMs = null;
	for (const r of reviews) {
		const raw = r?.publish_time;
		if (raw == null) continue;
		const ms = raw instanceof Date ? raw.getTime() : new Date(raw).getTime();
		if (!Number.isFinite(ms)) continue;
		if (newestMs === null || ms > newestMs) newestMs = ms;
	}
	if (newestMs === null) return null;

	const ageDays = (nowMs - newestMs) / 86400000;
	if (ageDays <= 0) return 100;
	return toPct(1 - ageDays / FRESHNESS_HORIZON_DAYS);
}

/**
 * Listing completeness — four things a diner looks for on a Google listing, each
 * worth 25. Purely presence checks against fields we asked Places for, so it can
 * never be wrong in the way a modelled number can.
 *
 * @param {{ opening_hours?: { weekday_text?: string[] }, website?: string|null,
 *           photo_count?: number, editorial_summary?: string|null }} place
 */
export function listingScore(place) {
	if (!place) return null;
	const checks = [
		Boolean(place.opening_hours?.weekday_text?.length),
		Boolean(place.website),
		Number(place.photo_count) > 0,
		Boolean(place.editorial_summary)
	];
	return toPct(checks.filter(Boolean).length / checks.length);
}

/** Which of the four listing checks passed — drives the "what's missing" copy. */
export function listingBreakdown(place) {
	return {
		hours: Boolean(place?.opening_hours?.weekday_text?.length),
		website: Boolean(place?.website),
		photos: Number(place?.photo_count) > 0,
		description: Boolean(place?.editorial_summary)
	};
}

const LABELS = {
	reputation: 'Reputation',
	visibility: 'Visibility',
	freshness: 'Freshness',
	listing: 'Listing'
};

/** Short, factual explanation of what each number was computed from. */
function basisFor(key, place) {
	const rating = place?.rating;
	const reviews = place?.review_count;
	switch (key) {
		case 'reputation':
			return rating != null ? `${rating.toFixed(1)}★ against a ${BENCHMARK_RATING}★ benchmark` : '';
		case 'visibility':
			return reviews != null ? `${reviews.toLocaleString('en-US')} public reviews` : '';
		case 'freshness':
			return 'Age of the most recent review Google returned';
		case 'listing': {
			const b = listingBreakdown(place);
			const missing = Object.entries(b)
				.filter(([, ok]) => !ok)
				.map(([k]) => k);
			return missing.length ? `Missing: ${missing.join(', ')}` : 'Hours, website, photos and description all present';
		}
		default:
			return '';
	}
}

/**
 * Build the four sub-scores in display order.
 * @param {object} place normalized place (provider output shape)
 * @param {number} [nowMs]
 * @returns {Array<{ key: string, label: string, value: number|null, basis: string }>}
 */
export function buildSubScores(place, nowMs = Date.now()) {
	const values = {
		reputation: reputationScore(place?.rating),
		visibility: visibilityScore(place?.review_count),
		freshness: freshnessScore(place?.top_reviews, nowMs),
		listing: listingScore(place)
	};

	return ['reputation', 'visibility', 'freshness', 'listing'].map((key) => ({
		key,
		label: LABELS[key],
		value: values[key],
		basis: basisFor(key, place)
	}));
}
