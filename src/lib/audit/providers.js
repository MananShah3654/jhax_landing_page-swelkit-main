/**
 * Audit data-source providers — running in the BROWSER, a faithful port of the
 * original data_source.py. Same normalized place shape, same errors, same
 * provider selection.
 *
 * Provider chosen by PUBLIC_AUDIT_DATA_SOURCE (default: osm):
 *   osm     -> OSMProvider     (OpenStreetMap Nominatim REST; allows CORS)
 *   google  -> GoogleProvider  (Google Maps JavaScript "Places" library)
 *
 * IMPORTANT: Google's Places REST endpoints (places.googleapis.com) do NOT send
 * CORS headers, so they can't be called with fetch() from a browser. The correct
 * client-side path is the Maps JavaScript API Places library, which we load on
 * demand below. Enable "Maps JavaScript API" + "Places API (New)" for the key and
 * restrict it by HTTP referrer.
 */
import { env } from '$env/dynamic/public';

// ---------- Errors ----------
export class PlaceNotFound extends Error {}
export class DataSourceError extends Error {}

// ---------- OpenStreetMap Nominatim ----------
class OSMProvider {
	data_source = 'estimated';

	/**
	 * DELIBERATELY REFUSES.
	 *
	 * Nominatim knows where a restaurant is, but has no rating and no reviews. This
	 * provider used to fill that gap with seededMetrics() — a SHA-256 hash turned
	 * into a plausible-looking rating and review count. Those numbers were stable
	 * per restaurant and looked entirely real, which is exactly what made them
	 * dangerous: the teaser presented invented figures as findings about a real
	 * business.
	 *
	 * The audit now refuses rather than fabricates. Set PUBLIC_AUDIT_DATA_SOURCE=google
	 * for live data. (seeded.js is kept — the parity harness still covers it as a
	 * regression guard on pyRound — but nothing in the audit path calls it.)
	 */
	#refuse() {
		throw new DataSourceError(
			'The OpenStreetMap source cannot supply ratings or reviews. ' +
				'Set PUBLIC_AUDIT_DATA_SOURCE=google to run a real audit.'
		);
	}

	// The resolver calls search()/detail(); fetch() is the older single-shot entry.
	// All three refuse identically, so no caller can slip past the refusal.
	// eslint-disable-next-line no-unused-vars
	async search(name, city, limit) {
		this.#refuse();
	}

	// eslint-disable-next-line no-unused-vars
	async detail(place, fallbackName) {
		this.#refuse();
	}

	// eslint-disable-next-line no-unused-vars
	async fetch(name, city) {
		this.#refuse();
	}

	// eslint-disable-next-line no-unused-vars
	async nearby(location, opts) {
		this.#refuse();
	}
}

/**
 * Normalize a Maps LatLng (methods) or a LatLngLiteral (plain numbers) to one shape.
 * Returns null rather than a half-filled point, so callers can test one thing.
 * @returns {{ lat: number, lng: number } | null}
 */
function toLatLng(loc) {
	if (!loc) return null;
	const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
	const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
	return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

// ---------- Google Maps JavaScript API loader (browser only) ----------
let _mapsLoad = /** @type {Promise<any> | null} */ (null);

/** Load (once) the Maps JS "places" library and resolve with it. */
function loadPlacesLibrary(apiKey) {
	if (_mapsLoad) return _mapsLoad;
	_mapsLoad = new Promise((resolve, reject) => {
		if (typeof window === 'undefined') {
			reject(new DataSourceError('Google Places is only available in the browser'));
			return;
		}
		const g = window;
		const start = () =>
			g.google.maps.importLibrary('places').then(resolve, (e) =>
				reject(new DataSourceError(`Maps places library failed: ${e}`))
			);

		if (g.google?.maps?.importLibrary) {
			start();
			return;
		}
		// Official Google Maps inline bootstrap loader (defines importLibrary).
		((cfg) => {
			let scriptEl;
			const doc = document;
			const win = window;
			const gm = (win.google || (win.google = {})).maps || ((win.google.maps = {}));
			const libs = new Set();
			const params = new URLSearchParams();
			const CB = '__ib__';
			let loadPromise;
			const ensure = () =>
				loadPromise ||
				(loadPromise = new Promise((res, rej) => {
					scriptEl = doc.createElement('script');
					params.set('libraries', [...libs].join(','));
					for (const key in cfg) {
						params.set(
							key.replace(/[A-Z]/g, (t) => '_' + t[0].toLowerCase()),
							cfg[key]
						);
					}
					params.set('callback', 'google.maps.' + CB);
					scriptEl.src = 'https://maps.googleapis.com/maps/api/js?' + params;
					gm[CB] = res;
					scriptEl.onerror = () => rej(new DataSourceError('Google Maps JS could not load'));
					scriptEl.nonce = doc.querySelector('script[nonce]')?.nonce || '';
					doc.head.append(scriptEl);
				}));
			gm.importLibrary = (name) => ensure().then(() => gm.importLibrary(name));
			// note: after the real API loads, it replaces importLibrary with its own.
			libs.add('places');
		})({ key: apiKey, v: 'weekly' });
		start();
	});
	return _mapsLoad;
}

/**
 * Compute whether a place is open right now from its regular weekly hours —
 * reproducing the REST `regularOpeningHours.openNow` the original backend used.
 * We do NOT use Place.isOpen() because it is beta-channel only (we load the stable
 * `weekly` channel). Returns true/false when hours are known, or null when the
 * data is insufficient (matches the backend, which returned null → no "closed" card).
 *
 * Periods use day 0..6 (Sunday=0). A period with an `open` point but no `close`
 * means open 24 hours. Periods may wrap past the end of the week (e.g. Fri 18:00 →
 * Sat 02:00), which we handle by comparing absolute minutes-within-week.
 * @param {any} place
 * @returns {boolean|null}
 */
function computeOpenNow(place) {
	const periods = place?.regularOpeningHours?.periods;
	const utc = place?.utcOffsetMinutes;
	if (!periods || periods.length === 0 || typeof utc !== 'number') return null;

	// "Wall clock" in the place's timezone: shift the epoch by the offset, read via UTC getters.
	const local = new Date(Date.now() + utc * 60000);
	const WEEK = 7 * 1440;
	const nowAbs = local.getUTCDay() * 1440 + local.getUTCHours() * 60 + local.getUTCMinutes();

	for (const p of periods) {
		const o = p?.open;
		if (!o || typeof o.day !== 'number') continue;
		// Open point with no close → open 24 hours.
		if (!p.close || typeof p.close.day !== 'number') return true;

		const openAbs = o.day * 1440 + (o.hour || 0) * 60 + (o.minute || 0);
		let closeAbs = p.close.day * 1440 + (p.close.hour || 0) * 60 + (p.close.minute || 0);
		if (closeAbs <= openAbs) closeAbs += WEEK; // period wraps into the next week

		if (
			(nowAbs >= openAbs && nowAbs < closeAbs) ||
			(nowAbs + WEEK >= openAbs && nowAbs + WEEK < closeAbs)
		) {
			return true;
		}
	}
	return false;
}


// ---------- Google Places (New) via Maps JS library ----------

/**
 * Build a media URL for a place's first photo, at the requested box.
 *
 * getURI() signs a URL from the photo reference — nothing is billed until the
 * browser actually loads it. A place with no photo, or a getURI that throws,
 * yields null: a missing thumbnail must never fail a card or an audit.
 *
 * @param {any} place @param {number} maxWidth @param {number} maxHeight
 * @returns {string|null}
 */
function photoUrlFor(place, maxWidth, maxHeight) {
	const first = (place?.photos || [])[0];
	if (!first || typeof first.getURI !== 'function') return null;
	try {
		return first.getURI({ maxWidth, maxHeight });
	} catch {
		return null;
	}
}

/**
 * Fields needed to DRAW a candidate card: name, address, star rating, thumbnail.
 * Deliberately small — a text search now returns up to five results, and asking
 * for reviews/hours on all five would pay the expensive Places SKU four times over
 * for places the user is about to discard.
 */
const CANDIDATE_FIELDS = ['id', 'displayName', 'formattedAddress', 'rating', 'userRatingCount', 'photos'];

/**
 * The rest of the audit's inputs, fetched for the ONE place that gets chosen.
 * `photos` and the card fields are already loaded by then, so they are not repeated.
 */
const DETAIL_FIELDS = [
	'reviews',
	// location + primaryType exist solely for the local ranking: you cannot search
	// "restaurants near here" without a centre, and searching for the wrong type
	// would rank a bakery against dinner houses.
	'location',
	'primaryType',
	'regularOpeningHours',
	'utcOffsetMinutes',
	'websiteURI',
	'editorialSummary',
	'priceLevel'
];

/**
 * What a rival is allowed to cost us. Nearby Search is billed per call by field tier,
 * and the ranking needs nothing beyond an identity and two numbers — no photos, no
 * hours, no reviews.
 */
const NEARBY_FIELDS = ['id', 'displayName', 'rating', 'userRatingCount'];

class GoogleProvider {
	data_source = 'google';

	constructor() {
		this.apiKey = env.PUBLIC_GOOGLE_PLACES_API_KEY || '';
	}

	/** Load the Places library, normalising every failure into DataSourceError. */
	async #places() {
		if (!this.apiKey) throw new DataSourceError('PUBLIC_GOOGLE_PLACES_API_KEY is not configured');
		try {
			return await loadPlacesLibrary(this.apiKey);
		} catch (exc) {
			if (exc instanceof DataSourceError) throw exc;
			throw new DataSourceError(`Google Places load failed: ${exc}`);
		}
	}

	/**
	 * Text-search for candidate places, cheapest fields only.
	 *
	 * Returns the raw Place instances (possibly empty) rather than throwing on an
	 * empty result — "no matches" is a legitimate outcome the resolver reports as
	 * `not_found`, not an error. Only genuine failures throw.
	 *
	 * @param {string} name
	 * @param {string} city
	 * @param {number} [limit] how many candidates to consider
	 * @returns {Promise<any[]>}
	 */
	async search(name, city, limit = 5) {
		const { Place } = await this.#places();
		const textQuery = `${name} ${city}`.trim();

		try {
			const { places } = await Place.searchByText({
				textQuery,
				fields: CANDIDATE_FIELDS,
				maxResultCount: Math.max(1, Math.min(20, limit))
			});
			return places || [];
		} catch (exc) {
			throw new DataSourceError(`Google Places request failed: ${exc}`);
		}
	}

	/**
	 * Load the remaining fields for a chosen place and normalise it into the shape
	 * the heuristics consume — the same object the old single-shot fetch() returned.
	 *
	 * @param {any} place a Place instance from search()
	 * @param {string} [fallbackName] used only if Google somehow has no displayName
	 */
	async detail(place, fallbackName = '') {
		if (!place) throw new PlaceNotFound();

		// searchByText only populated the card fields; pull the audit's inputs now.
		// A failure here is fatal — unlike a missing photo, the audit has no numbers
		// to report without hours and reviews.
		if (typeof place.fetchFields === 'function') {
			try {
				await place.fetchFields({ fields: DETAIL_FIELDS });
			} catch (exc) {
				throw new DataSourceError(`Google Places detail request failed: ${exc}`);
			}
		}

		// open_now — computed from regularOpeningHours.periods + utcOffsetMinutes,
		// reproducing the REST regularOpeningHours.openNow the backend used.
		const openNow = computeOpenNow(place);

		const topReviews = [];
		for (const rv of (place.reviews || []).slice(0, 5)) {
			topReviews.push({
				author: rv.authorAttribution?.displayName ?? null,
				rating: rv.rating ?? null,
				text: rv.text ?? null,
				relative_time: rv.relativePublishTimeDescription ?? null,
				// Absolute timestamp drives the Freshness sub-score; the relative string
				// Google gives us ("3 months ago") is display-only and not parseable.
				publish_time: rv.publishTime ? new Date(rv.publishTime).toISOString() : null
			});
		}

		return {
			// Carried so the ranking can exclude this place from its own competitor
			// list by identity rather than by name.
			id: place.id ?? null,
			name: place.displayName || fallbackName,
			address: place.formattedAddress ?? null,
			location: toLatLng(place.location),
			primary_type: place.primaryType ?? null,
			rating: place.rating ?? null,
			review_count: place.userRatingCount ?? null,
			top_reviews: topReviews,
			opening_hours: {
				open_now: openNow,
				weekday_text: place.regularOpeningHours?.weekdayDescriptions || []
			},
			photo_url: photoUrlFor(place, 640, 480),
			photo_count: (place.photos || []).length,
			website: place.websiteURI ?? null,
			editorial_summary: place.editorialSummary ?? null,
			price_level: place.priceLevel ?? null,
			data_source: this.data_source
		};
	}

	/**
	 * The restaurants a diner would realistically choose instead of this one.
	 *
	 * Returns a plain array (possibly empty) rather than throwing when the area is
	 * quiet — "nothing comparable nearby" is a legitimate answer that the ranking
	 * turns into a refusal, not a failure that should surface to the user. Only a
	 * genuinely broken request throws, and even that is caught by the caller: the
	 * local rank is a bonus panel and must never take down an audit that otherwise
	 * succeeded.
	 *
	 * @param {{ lat: number, lng: number }} location centre of the search
	 * @param {{ radiusM?: number, primaryType?: string|null, limit?: number }} [opts]
	 * @returns {Promise<Array<{ id: string|null, name: string, rating: number|null, review_count: number|null }>>}
	 */
	async nearby(location, opts = {}) {
		const { Place } = await this.#places();
		const radius = opts.radiusM ?? 1500;
		// includedTypes, NOT includedPrimaryTypes. A place whose primary type is
		// "indian_restaurant" does not match a primary-type filter of "restaurant",
		// so filtering on the primary type would drop most of the street and rank the
		// subject against the handful of places Google happens to type generically.
		// The subject's own type joins the list so a cafe is compared with cafes too.
		const types = [...new Set(['restaurant', opts.primaryType].filter(Boolean))];

		let places;
		try {
			({ places } = await Place.searchNearby({
				fields: NEARBY_FIELDS,
				locationRestriction: { center: { lat: location.lat, lng: location.lng }, radius },
				includedTypes: types,
				maxResultCount: Math.max(1, Math.min(20, opts.limit ?? 20))
			}));
		} catch (exc) {
			throw new DataSourceError(`Google Places nearby request failed: ${exc}`);
		}

		return (places || []).map((p) => ({
			id: p.id ?? null,
			name: p.displayName || '',
			rating: p.rating ?? null,
			review_count: p.userRatingCount ?? null
		}));
	}

	/**
	 * Single-shot lookup: take the top result and run with it.
	 *
	 * Kept for callers that have already decided which place they want (and for the
	 * no-disambiguation path). The audit's normal entry point is resolvePlace(),
	 * which will not silently pick a winner when the match is not confident.
	 *
	 * @param {string} name @param {string} city
	 */
	async fetch(name, city) {
		const places = await this.search(name, city, 1);
		if (places.length === 0) throw new PlaceNotFound();
		return this.detail(places[0], name);
	}
}
const PROVIDERS = { osm: OSMProvider, google: GoogleProvider };

/** Return the active provider, chosen by PUBLIC_AUDIT_DATA_SOURCE (default: osm). */
export function getProvider() {
	const source = (env.PUBLIC_AUDIT_DATA_SOURCE || 'osm').trim().toLowerCase();
	const ProviderCls = PROVIDERS[source] || OSMProvider;
	return new ProviderCls();
}
