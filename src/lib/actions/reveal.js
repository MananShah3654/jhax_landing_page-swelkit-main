/**
 * `reveal` action — Svelte equivalent of framer-motion's whileInView + viewport.
 *
 * Calls `onReveal` the first time the node enters the viewport (respecting an
 * intersection threshold). With `once: false` it also calls `onLeave` when the
 * node leaves. On environments without IntersectionObserver (SSR/old browsers)
 * it reveals immediately so content is never hidden.
 *
 * Usage:
 *   <div use:reveal={{ amount: 0.3, onReveal: () => (inView = true) }}>
 *
 * @param {HTMLElement} node
 * @param {{ once?: boolean, amount?: number, onReveal?: () => void, onLeave?: () => void }} [params]
 */
export function reveal(node, params = {}) {
	let { once = true, amount = 0.2, onReveal, onLeave } = params;

	if (typeof IntersectionObserver === 'undefined') {
		onReveal?.();
		return {};
	}

	const observer = new IntersectionObserver(
		(entries) => {
			for (const entry of entries) {
				if (entry.isIntersecting) {
					onReveal?.();
					if (once) observer.disconnect();
				} else if (!once) {
					onLeave?.();
				}
			}
		},
		{ threshold: Math.max(0, Math.min(1, amount)) }
	);
	observer.observe(node);

	return {
		update(next = {}) {
			({ once = true, amount = 0.2, onReveal, onLeave } = next);
		},
		destroy() {
			observer.disconnect();
		}
	};
}
