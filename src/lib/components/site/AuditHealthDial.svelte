<script>
	import { onMount } from 'svelte';

	let { value = 0 } = $props();

	const size = 128;
	const stroke = 10;
	const r = (size - stroke) / 2;
	const circ = 2 * Math.PI * r;

	let pct = $derived(Math.max(0, Math.min(100, value)));
	let offset = $derived(circ - (pct / 100) * circ);
	let color = $derived(pct >= 75 ? '#22C55E' : pct >= 50 ? '#FF6B2B' : '#F87171');
	let label = $derived(pct >= 75 ? 'Good' : pct >= 50 ? 'Needs work' : 'At risk');

	// Animate the arc from empty (circ) to its target offset on mount.
	let dash = $state(circ);
	onMount(() => {
		requestAnimationFrame(() => (dash = offset));
	});
</script>

<div
	class="relative flex items-center justify-center flex-shrink-0"
	style="width: {size}px; height: {size}px;"
	data-testid="audit-health-dial"
>
	<svg width={size} height={size}>
		<circle cx={size / 2} cy={size / 2} {r} stroke="#1E1E1E" stroke-width={stroke} fill="none" />
		<circle
			cx={size / 2}
			cy={size / 2}
			{r}
			stroke={color}
			stroke-width={stroke}
			fill="none"
			stroke-linecap="round"
			stroke-dasharray={circ}
			stroke-dashoffset={dash}
			style="transform: rotate(-90deg); transform-origin: 50% 50%; transition: stroke-dashoffset 1.1s cubic-bezier(0.22, 1, 0.36, 1);"
		/>
	</svg>
	<div class="absolute inset-0 flex flex-col items-center justify-center">
		<div class="font-display text-cream" style="font-size: 36px; letter-spacing: -0.03em; line-height: 1;">
			{pct}
		</div>
		<div class="font-mono uppercase tracking-[0.2em]" style="font-size: 9px; color: {color};">
			{label}
		</div>
	</div>
</div>
