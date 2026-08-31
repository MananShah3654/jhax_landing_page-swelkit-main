/**
 * Audit heuristics — the ESTIMATE formulas, unchanged from the original FastAPI
 * backend (server.py). Pure module (no env / platform imports) so it runs both in
 * the browser and under the parity harness. Rounding matches Python's built-in
 * round() (round-half-to-even) so numbers are byte-identical to the original.
 */

export const BENCHMARK_RATING = 4.7;
export const ASSUMED_WEEKLY_REVENUE = 12000.0;
export const REVENUE_PER_STAR = 0.07;
export const VISIBILITY_REVIEW_FLOOR = 150;
export const VISIBILITY_PENALTY = 0.03;

/**
 * Replicate CPython's round() on a float: correctly-rounded, round-half-to-even.
 * Operates on the exact IEEE-754 double (ties only at an exact .5).
 * @param {number} value @param {number} [ndigits=0]
 */
export function pyRound(value, ndigits = 0) {
	if (!Number.isFinite(value)) return value;
	const m = Math.pow(10, ndigits);
	const scaled = value * m;
	const floor = Math.floor(scaled);
	const diff = scaled - floor;

	let n;
	if (diff < 0.5) n = floor;
	else if (diff > 0.5) n = floor + 1;
	else n = floor % 2 === 0 ? floor : floor + 1; // exact tie → round to even

	return ndigits === 0 ? n : n / m;
}

/**
 * @param {number|null|undefined} rating
 * @param {number|null|undefined} reviewCount
 * @returns {number} integer 0..100
 */
export function estimateHealthScore(rating, reviewCount) {
	rating = rating || 0.0;
	reviewCount = reviewCount || 0;
	const ratingScore = Math.max(0.0, Math.min(1.0, (rating - 2.5) / 2.5));
	const volumeScore = Math.max(
		0.0,
		Math.min(1.0, Math.log10(reviewCount + 1) / Math.log10(1000))
	);
	const score = pyRound((0.75 * ratingScore + 0.25 * volumeScore) * 100);
	return Math.trunc(Math.max(0, Math.min(100, score)));
}

/**
 * @param {number|null|undefined} rating
 * @param {number|null|undefined} reviewCount
 * @returns {number} integer dollars/week
 */
export function estimateMoneyLostWeekly(rating, reviewCount) {
	rating = rating || 0.0;
	reviewCount = reviewCount || 0;
	const reputationLoss =
		ASSUMED_WEEKLY_REVENUE * REVENUE_PER_STAR * Math.max(0.0, BENCHMARK_RATING - rating);
	let visibilityLoss = 0.0;
	if (reviewCount < VISIBILITY_REVIEW_FLOOR) {
		const shortfall = (VISIBILITY_REVIEW_FLOOR - reviewCount) / VISIBILITY_REVIEW_FLOOR;
		visibilityLoss = ASSUMED_WEEKLY_REVENUE * VISIBILITY_PENALTY * shortfall;
	}
	return pyRound(reputationLoss + visibilityLoss);
}

/** @param {number} score */
export function healthLabel(score) {
	if (score >= 75) return 'Good';
	if (score >= 50) return 'Needs work';
	return 'At risk';
}
