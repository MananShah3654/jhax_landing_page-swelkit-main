/**
 * Vendor-neutral analytics sink.
 *
 * This site has no analytics vendor wired up yet, and picking one is not this
 * module's job. `track()` pushes a flat event object onto `window.dataLayer` —
 * the format GTM, GA4, Segment and PostHog's GTM bridge all read — and calls
 * `gtag()` directly if one happens to be on the page. With nothing listening it
 * is a silent no-op, so call sites never have to guard.
 *
 * Adding a vendor later is a snippet in app.html and zero changes here or at any
 * call site.
 */
import { browser } from '$app/environment';

/**
 * Record a product event.
 *
 * Never throws: analytics failing must never take a user flow down with it, so
 * every sink is wrapped. Server-side (prerender) calls are dropped rather than
 * queued — an event nobody was on screen for is not worth replaying.
 *
 * @param {string} event snake_case event name
 * @param {Record<string, any>} [props] flat, JSON-safe properties
 */
export function track(event, props = {}) {
	if (!browser || !event) return;

	try {
		const win = /** @type {any} */ (window);
		(win.dataLayer = win.dataLayer || []).push({ event, ...props });
		if (typeof win.gtag === 'function') win.gtag('event', event, props);
	} catch {
		/* blocked storage, hostile extension, sealed window — non-fatal by design */
	}

	if (import.meta.env.DEV) console.debug('[analytics]', event, props);
}
