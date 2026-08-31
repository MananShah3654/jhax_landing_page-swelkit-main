<script>
	import Reveal from './Reveal.svelte';
	import { isIndiaRoute } from '@/siteVariant.js';

	const INDIA = isIndiaRoute();
	const items = INDIA
		? [
				{ name: 'Petpooja', status: 'live' },
				{ name: 'Posist', status: 'soon' },
				{ name: 'UrbanPiper', status: 'soon' },
				{ name: 'WhatsApp Business', status: 'soon' },
				{ name: 'Zomato', status: 'soon' },
				{ name: 'Swiggy', status: 'soon' }
			]
		: [
				{ name: 'Square POS', status: 'live' },
				{ name: 'QuickBooks', status: 'soon' },
				{ name: 'WhatsApp Business', status: 'soon' },
				{ name: 'Toast', status: 'soon' },
				{ name: 'Clover', status: 'soon' }
			];

	const slug = (s) => s.toLowerCase().replace(/\s+/g, '-');
</script>

<section
	data-testid="trust-strip"
	class="relative py-8 border-y"
	style="border-color: #151515; background: linear-gradient(180deg, rgba(232,80,10,0.02), transparent);"
>
	<div
		class="max-w-[1400px] mx-auto px-6 md:px-10 flex flex-wrap items-center gap-x-10 gap-y-4"
	>
		<div class="font-mono text-[11px] uppercase text-orange tracking-[0.24em]">Plugs into</div>

		<div class="flex flex-wrap items-center gap-x-8 gap-y-3">
			{#each items as it, i (it.name)}
				<Reveal
					y={8}
					delay={i * 0.05}
					amount={0.6}
					duration={0.5}
					class="flex items-center gap-2 text-cream text-[15px]"
					style="font-weight: 500;"
					testid="integration-{slug(it.name)}"
				>
					<span>{it.name}</span>
					{#if it.status === 'live'}
						<span
							class="font-mono text-[10px] px-2 py-0.5 rounded-full"
							style="background: rgba(22,163,74,0.12); color: #16A34A; border: 1px solid rgba(22,163,74,0.35);"
						>
							✓ LIVE
						</span>
					{:else}
						<span
							class="font-mono text-[10px] px-2 py-0.5 rounded-full text-muted-warm"
							style="border: 1px solid #1E1E1E;"
						>
							soon
						</span>
					{/if}
				</Reveal>
			{/each}
		</div>

		<div
			class="ml-auto flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-warm"
		>
			<span class="w-1.5 h-1.5 rounded-full dot-pulse" style="background: #16A34A;"></span>
			{INDIA ? '1 India restaurant using JHAX right now' : '1 restaurant using JHAX right now'}
		</div>
	</div>
</section>
