<script>
	// Reusable enter-animation wrapper — Svelte equivalent of framer-motion's
	// `initial` / `whileInView` (or `animate`) + `transition`. Animates opacity and
	// an x/y offset back to rest when the element scrolls into view (once), or on
	// mount when `immediate` is set (above-the-fold entrances).
	import { onMount } from 'svelte';
	import { reveal } from '@/actions/reveal.js';

	let {
		tag = 'div',
		y = 0,
		x = 0,
		from = 0, // initial opacity
		duration = 0.6,
		delay = 0,
		amount = 0.2,
		once = true,
		immediate = false,
		ease = 'cubic-bezier(0.22, 1, 0.36, 1)',
		class: className = '',
		style = '',
		testid = undefined,
		children,
		...rest
	} = $props();

	let shown = $state(false);

	onMount(() => {
		if (immediate) requestAnimationFrame(() => (shown = true));
	});
</script>

<svelte:element
	this={tag}
	use:reveal={{ once, amount, onReveal: () => (shown = true) }}
	class={className}
	data-testid={testid}
	style="opacity: {shown ? 1 : from}; transform: translate({shown ? 0 : x}px, {shown
		? 0
		: y}px); transition: opacity {duration}s {ease} {delay}s, transform {duration}s {ease} {delay}s; {style}"
	{...rest}
>
	{@render children()}
</svelte:element>
