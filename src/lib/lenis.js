// Shared holder for the Lenis smooth-scroll instance. Native scrollIntoView /
// window.scrollTo are overridden by Lenis's RAF loop every frame, so programmatic
// scrolls must go through Lenis. The layout sets `current`; components call scrollToEl().
export const lenisStore = { current: /** @type {any} */ (null) };

/**
 * Smooth-scroll to an element (HTMLElement or an element id), leaving room for
 * the fixed header. Falls back to native scrollIntoView if Lenis isn't ready.
 * @param {HTMLElement | string} target  element or element id
 * @param {number} [offset=-80]  px offset (negative = stop above the element)
 */
export function scrollToEl(target, offset = -80) {
	const el = typeof target === 'string' ? document.getElementById(target) : target;
	if (!el) return;
	if (lenisStore.current) {
		lenisStore.current.scrollTo(el, { offset, duration: 1.0 });
	} else {
		el.scrollIntoView({ behavior: 'smooth', block: 'start' });
	}
}
