<script>
	import Reveal from './Reveal.svelte';
	import { isIndiaRoute } from '@/siteVariant.js';

	const stats = isIndiaRoute()
		? [
				{ v: '₹680Cr+', l: 'Potential weekly revenue leakage across fast-moving brands' },
				{ v: '60 sec', l: 'Time to get a clear answer about your restaurant' },
				{ v: '₹33K+', l: 'Found per restaurant every week on average' },
				{ v: '1 app', l: 'Replaces 6+ things operators check every day' }
			]
		: [
				{ v: '$82.7B', l: 'Size of the restaurant AI market by 2034' },
				{ v: '60 sec', l: 'Time to get a full answer about your restaurant' },
				{ v: '$400+', l: 'Found per restaurant every week on average' },
				{ v: '1 app', l: 'Replaces 6+ things restaurant owners use every day' }
			];
</script>

<section
	data-testid="stats-strip"
	class="relative py-16 md:py-20"
	style="background: rgba(232,80,10,0.04); border-top: 1px solid rgba(232,80,10,0.28); border-bottom: 1px solid rgba(232,80,10,0.28);"
>
	<div
		class="max-w-[1280px] mx-auto px-6 md:px-10 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-4"
	>
		{#each stats as s, i (s.l)}
			<Reveal
				y={20}
				delay={i * 0.08}
				amount={0.4}
				class="flex flex-col"
				testid="stat-{i}"
			>
				<div
					class="font-display"
					style="color: #E8500A; font-size: clamp(44px, 6vw, 72px); letter-spacing: -0.04em; line-height: 0.95;"
				>
					{s.v}
				</div>
				<div class="mt-3 font-mono text-[11px] uppercase tracking-[0.24em] text-muted-warm">
					{s.l}
				</div>
			</Reveal>
		{/each}
	</div>
</section>
