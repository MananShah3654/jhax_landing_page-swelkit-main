<script>
	// Reusable numbered section header — "01 / THE PROBLEM". Editorial monospace
	// chapter number + label. The big headline is passed as children.
	import { reveal } from '@/actions/reveal.js';

	let { number, label, sub = '', align = 'left', children } = $props();

	let isCenter = $derived(align === 'center');
	let r1 = $state(false);
	let r2 = $state(false);
	let r3 = $state(false);

	const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
</script>

<div class="max-w-[1180px] mx-auto px-6 md:px-10 {isCenter ? 'text-center' : 'text-left'}">
	<div
		use:reveal={{ amount: 0.4, onReveal: () => (r1 = true) }}
		class="flex items-center gap-3 {isCenter ? 'justify-center' : ''}"
		style="opacity: {r1 ? 1 : 0}; transform: translateY({r1 ? 0 : 12}px); transition: opacity .6s {EASE}, transform .6s {EASE};"
	>
		<span class="font-mono text-[11px] tracking-[0.24em] text-orange" data-testid="chapter-num-{number}">
			{number}
		</span>
		<span
			class="h-px flex-1 max-w-[80px]"
			style="background: linear-gradient(90deg, #E8500A, transparent);"
		></span>
		<span class="font-mono text-[11px] tracking-[0.24em] text-muted-warm uppercase">
			{label}
		</span>
	</div>

	<h2
		use:reveal={{ amount: 0.3, onReveal: () => (r2 = true) }}
		class="mt-6 font-display text-cream"
		style="font-size: clamp(38px, 6vw, 78px); letter-spacing: -0.035em; line-height: 0.95; opacity: {r2 ? 1 : 0}; transform: translateY({r2 ? 0 : 20}px); transition: opacity .8s {EASE} .08s, transform .8s {EASE} .08s;"
	>
		{@render children()}
	</h2>

	{#if sub}
		<p
			use:reveal={{ amount: 0.2, onReveal: () => (r3 = true) }}
			class="mt-5 text-muted-warm {isCenter ? 'mx-auto' : ''}"
			style="max-width: 620px; font-size: 18px; font-weight: 300; line-height: 1.55; opacity: {r3 ? 1 : 0}; transition: opacity .6s {EASE} .2s;"
		>
			{sub}
		</p>
	{/if}
</div>
