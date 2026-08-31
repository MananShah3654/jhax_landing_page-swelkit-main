/**
 * Small motion helpers to replace the few framer-motion JS-driven animations
 * (numeric counters). Scroll/entrance reveals use CSS transitions with the exact
 * cubic-bezier strings, so easing there is already identical to the original.
 */

/**
 * Standard cubic-bezier easing solver (same math browsers use for
 * `transition-timing-function: cubic-bezier(...)`). Returns f(t) for t in [0,1].
 * @param {number} x1 @param {number} y1 @param {number} x2 @param {number} y2
 * @returns {(t: number) => number}
 */
export function cubicBezier(x1, y1, x2, y2) {
	const cx = 3 * x1;
	const bx = 3 * (x2 - x1) - cx;
	const ax = 1 - cx - bx;
	const cy = 3 * y1;
	const by = 3 * (y2 - y1) - cy;
	const ay = 1 - cy - by;

	const sampleX = (t) => ((ax * t + bx) * t + cx) * t;
	const sampleY = (t) => ((ay * t + by) * t + cy) * t;
	const sampleDX = (t) => (3 * ax * t + 2 * bx) * t + cx;

	const solveX = (x) => {
		let t = x;
		for (let i = 0; i < 8; i++) {
			const xt = sampleX(t) - x;
			if (Math.abs(xt) < 1e-6) return t;
			const d = sampleDX(t);
			if (Math.abs(d) < 1e-6) break;
			t -= xt / d;
		}
		// Bisection fallback
		let lo = 0;
		let hi = 1;
		t = x;
		while (lo < hi) {
			const xt = sampleX(t);
			if (Math.abs(xt - x) < 1e-6) return t;
			if (x > xt) lo = t;
			else hi = t;
			t = (lo + hi) / 2;
		}
		return t;
	};

	return (t) => {
		if (t <= 0) return 0;
		if (t >= 1) return 1;
		return sampleY(solveX(t));
	};
}

// The project's signature easing, used everywhere: cubic-bezier(0.22, 1, 0.36, 1).
export const EASE_OUT_EXPO = cubicBezier(0.22, 1, 0.36, 1);

/**
 * Animate a number from `from` to `to` over `duration` seconds using `ease`,
 * calling `onUpdate(value)` each frame. Mirrors framer-motion's animate() for a
 * scalar. Returns a stop() function.
 * @param {{ from: number, to: number, duration: number, ease?: (t:number)=>number,
 *   onUpdate: (v:number)=>void, onComplete?: () => void }} opts
 */
export function animateValue({ from, to, duration, ease = EASE_OUT_EXPO, onUpdate, onComplete }) {
	if (typeof requestAnimationFrame === 'undefined') {
		onUpdate(to);
		onComplete?.();
		return () => {};
	}
	let raf = 0;
	let start = 0;
	let stopped = false;
	const ms = Math.max(1, duration * 1000);

	const step = (now) => {
		if (stopped) return;
		if (!start) start = now;
		const t = Math.min(1, (now - start) / ms);
		onUpdate(from + (to - from) * ease(t));
		if (t < 1) {
			raf = requestAnimationFrame(step);
		} else {
			onComplete?.();
		}
	};
	raf = requestAnimationFrame(step);

	return () => {
		stopped = true;
		if (raf) cancelAnimationFrame(raf);
	};
}
