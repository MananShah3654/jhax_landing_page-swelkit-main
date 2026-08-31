<script>
	// One slow editorial marquee — kinetic type, very subtle. Content is duplicated
	// twice for a seamless loop (CSS .marquee-track animation in app.css).
	import { isIndiaRoute } from '@/siteVariant.js';

	const words = isIndiaRoute()
		? [
				'Your restaurant in India.',
				'On autopilot.',
				'Answers in 60 seconds.',
				'Finds ₹33,000 a week.',
				'Plugs into Petpooja & Posist.',
				'Built for restaurant owners.',
				"1 outlet. 15. Doesn't matter.",
				'Spots it. Finds why. Fixes it. Shows the money back.'
			]
		: [
				'Your restaurant.',
				'On autopilot.',
				'Answers in 60 seconds.',
				'Finds $400 a week.',
				'Plugs into Square.',
				'Built for restaurant owners.',
				"1 restaurant. 15. Doesn't matter.",
				'Spots it. Finds why. Fixes it. Shows the money back.'
			];
</script>

{#snippet content()}
	<div class="flex items-center shrink-0">
		{#each words as w, i (`${w}-${i}`)}
			<span
				class="font-display flex items-center whitespace-nowrap"
				style="font-size: clamp(48px, 9vw, 120px); letter-spacing: -0.045em; line-height: 1; color: {i %
					2 ===
				0
					? '#F5F2ED'
					: 'transparent'}; -webkit-text-stroke: {i % 2 === 1 ? '1px #E8500A' : '0'}; padding: 0 40px;"
			>
				{w}
				<span
					aria-hidden="true"
					class="inline-block ml-10"
					style="width: 14px; height: 14px; background: #E8500A; transform: rotate(45deg);"
				></span>
			</span>
		{/each}
	</div>
{/snippet}

<section
	aria-label="editorial marquee"
	data-testid="editorial-marquee"
	class="relative py-14 md:py-20 overflow-hidden border-y"
	style="background: #0a0a0a; border-color: #141414;"
>
	<div class="flex marquee-track">
		{@render content()}
		{@render content()}
	</div>

	<div
		aria-hidden="true"
		class="absolute inset-y-0 left-0 w-32 pointer-events-none"
		style="background: linear-gradient(90deg, #0a0a0a, transparent);"
	></div>
	<div
		aria-hidden="true"
		class="absolute inset-y-0 right-0 w-32 pointer-events-none"
		style="background: linear-gradient(270deg, #0a0a0a, transparent);"
	></div>
</section>
