/**
 * Deterministic pseudo-metrics for the OSM provider (which has no rating/review
 * data). Faithful port of _seeded_metrics in the original data_source.py — same
 * SHA-256 seeding, same ranges — but using the Web Crypto API so it runs in the
 * browser (and in Node ≥18, which exposes the same global `crypto`, for parity).
 */
import { pyRound } from './heuristics.js';

/**
 * @param {string} key
 * @returns {Promise<[number, number]>}  [rating (3.2–4.8, 1dp), reviewCount (20–400)]
 */
export async function seededMetrics(key) {
	const bytes = new TextEncoder().encode(key);
	const digest = await crypto.subtle.digest('SHA-256', bytes);
	const view = new DataView(digest);
	const a = view.getUint32(0, false) / 0xffffffff; // big-endian, 0..1
	const b = view.getUint32(4, false) / 0xffffffff; // big-endian, 0..1
	const rating = pyRound(3.2 + a * (4.8 - 3.2), 1);
	const reviewCount = Math.trunc(20 + b * (400 - 20));
	return [rating, reviewCount];
}
