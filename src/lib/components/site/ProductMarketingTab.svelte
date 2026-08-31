<script>
	import { ArrowRight } from 'lucide-svelte';
	import { isIndiaRoute } from '@/siteVariant.js';

	// Each goal drives a fully tailored promotional banner + ROI readout, so
	// picking a chip visibly regenerates the promotion.
	const INDIA = isIndiaRoute();
	const PROMOS = INDIA
		? [
				{
					goal: 'Bring back customers who stopped coming',
					badge: '20% OFF',
					eyebrow: 'We miss you — come back this week',
					headline: ['Your favorite table', 'is waiting.'],
					offer: '20% off your next visit · Valid this week only',
					cta: 'Send win-back offer',
					gradient: 'linear-gradient(135deg, #1a0d05 0%, #E8500A 55%, #FF6B2B 100%)',
					roi: { made: '₹28,220 in 48 hours', people: '8 people came back', stats: [['Sent to', '127'], ['Opened', '89'], ['Redeemed', '8'], ['Recovered', '₹28,220']] }
				},
				{
					goal: 'Fill Tuesday lunch',
					badge: 'TUE ONLY',
					eyebrow: 'Tuesday just got tastier',
					headline: ['Lunch for two,', 'just ₹999.'],
					offer: 'Every Tuesday 11–2 · Dine-in only',
					cta: 'Launch Tuesday deal',
					gradient: 'linear-gradient(135deg, #05141a 0%, #0D9488 55%, #22C55E 100%)',
					roi: { made: '₹42,496 in one Tuesday', people: '23 extra covers', stats: [['Sent to', '210'], ['Opened', '140'], ['Redeemed', '23'], ['Recovered', '₹42,496']] }
				},
				{
					goal: 'Push high-margin deal',
					badge: '2-FOR-1',
					eyebrow: "This week's chef's special",
					headline: ['Paneer Tikka Platters —', '2 for 1.'],
					offer: '68% margin favorite · While they last',
					cta: 'Push this deal',
					gradient: 'linear-gradient(135deg, #1a0d05 0%, #D97706 55%, #FF6B2B 100%)',
					roi: { made: '₹1,17,196 in 5 days', people: '47 platters sold', stats: [['Sent to', '180'], ['Opened', '120'], ['Redeemed', '47'], ['Recovered', '₹1,17,196']] }
				},
				{
					goal: 'Promote new menu item',
					badge: 'NEW',
					eyebrow: 'Fresh on the menu',
					headline: ['Meet the', 'Truffle Kulcha.'],
					offer: 'New this week · First 50 get it free',
					cta: 'Announce new item',
					gradient: 'linear-gradient(135deg, #1a0d05 0%, #E8500A 55%, #FFB07A 100%)',
					roi: { made: '₹57,104 in the first week', people: '50 people tried it', stats: [['Sent to', '260'], ['Opened', '175'], ['Redeemed', '50'], ['Recovered', '₹57,104']] }
				}
			]
		: [
				{
					goal: 'Bring back customers who stopped coming',
					badge: '20% OFF',
					eyebrow: 'We miss you — come back this week',
					headline: ['Your favorite table', 'is waiting.'],
					offer: '20% off your next visit · Valid this week only',
					cta: 'Send win-back offer',
					gradient: 'linear-gradient(135deg, #1a0d05 0%, #E8500A 55%, #FF6B2B 100%)',
					roi: { made: '$340 in 48 hours', people: '8 people came back', stats: [['Sent to', '127'], ['Opened', '89'], ['Redeemed', '8'], ['Recovered', '$340']] }
				},
				{
					goal: 'Fill Tuesday lunch',
					badge: 'TUE ONLY',
					eyebrow: 'Tuesday just got tastier',
					headline: ['Lunch for two,', 'just $24.'],
					offer: 'Every Tuesday 11–2 · Dine-in only',
					cta: 'Launch Tuesday deal',
					gradient: 'linear-gradient(135deg, #05141a 0%, #0D9488 55%, #22C55E 100%)',
					roi: { made: '$512 in one Tuesday', people: '23 extra covers', stats: [['Sent to', '210'], ['Opened', '140'], ['Redeemed', '23'], ['Recovered', '$512']] }
				},
				{
					goal: 'Push high-margin deal',
					badge: '2-FOR-1',
					eyebrow: "This week's chef's special",
					headline: ['Wagyu Sliders —', '2 for 1.'],
					offer: '68% margin favorite · While they last',
					cta: 'Push this deal',
					gradient: 'linear-gradient(135deg, #1a0d05 0%, #D97706 55%, #FF6B2B 100%)',
					roi: { made: '$1,412 in 5 days', people: '47 sliders sold', stats: [['Sent to', '180'], ['Opened', '120'], ['Redeemed', '47'], ['Recovered', '$1,412']] }
				},
				{
					goal: 'Promote new menu item',
					badge: 'NEW',
					eyebrow: 'Fresh on the menu',
					headline: ['Meet the', 'Truffle Melt.'],
					offer: 'New this week · First 50 get it free',
					cta: 'Announce new item',
					gradient: 'linear-gradient(135deg, #1a0d05 0%, #E8500A 55%, #FFB07A 100%)',
					roi: { made: '$688 in the first week', people: '50 people tried it', stats: [['Sent to', '260'], ['Opened', '175'], ['Redeemed', '50'], ['Recovered', '$688']] }
				}
			];

	let goal = $state(0);
	let promo = $derived(PROMOS[goal]);
</script>

<div class="grid gap-5">
	<div class="rounded-xl p-5" style="background: #0a0a0a; border: 1px solid #1E1E1E;">
		<div class="font-mono text-[10px] uppercase tracking-[0.24em] text-orange mb-3">
			Promotion Builder · Goal
		</div>
		<div class="flex flex-wrap gap-2">
			{#each PROMOS as p, i (p.goal)}
				<button
					type="button"
					onclick={() => (goal = i)}
					data-testid="promo-goal-{i}"
					aria-pressed={goal === i}
					class="px-3 py-2 rounded-full text-[12.5px] transition-colors"
					style="background: {goal === i ? 'rgba(232,80,10,0.14)' : '#0f0f0f'}; color: {goal === i
						? '#FF6B2B'
						: '#8a8785'}; border: 1px solid {goal === i ? 'rgba(232,80,10,0.4)' : '#1E1E1E'};"
				>
					{p.goal}
				</button>
			{/each}
		</div>
	</div>

	<!-- Banner preview (regenerates per goal) -->
	<div class="rounded-xl overflow-hidden" style="border: 1px solid #1E1E1E;">
		<div
			class="flex items-center justify-between px-4 py-2 border-b"
			style="border-color: #1E1E1E; background: #0a0a0a;"
		>
			<div class="font-mono text-[10px] uppercase tracking-[0.24em] text-ghost">
				Banner preview · Generated in 3s
			</div>
			<div class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-warm">
				{INDIA ? 'WhatsApp · SMS · Instagram' : 'WhatsApp · SMS · IG'}
			</div>
		</div>
		{#key goal}
			<div
				class="relative p-6 sm:p-8 md:p-10"
				style="background: {promo.gradient};"
				data-testid="promo-banner"
			>
				<div
					aria-hidden="true"
					class="absolute inset-0 opacity-30"
					style="background-image: radial-gradient(#00000030 1px, transparent 1px); background-size: 12px 12px;"
				></div>

				<!-- discount / offer badge -->
				<div
					class="absolute top-4 right-4 font-mono text-[10px] uppercase tracking-[0.18em] px-2.5 py-1 rounded-full"
					style="background: rgba(255,255,255,0.16); color: #fff; border: 1px solid rgba(255,255,255,0.35); backdrop-filter: blur(4px);"
				>
					{promo.badge}
				</div>

				<div class="relative max-w-[85%]">
					<div class="font-mono text-[10px] uppercase tracking-[0.28em]" style="color: #FFE3D0;">
						{promo.eyebrow}
					</div>
					<div
						class="mt-2 font-display text-white"
						style="font-size: clamp(26px, 3.8vw, 44px); letter-spacing: -0.03em; line-height: 1.05;"
					>
						{promo.headline[0]}
						<br />
						{promo.headline[1]}
					</div>
					<div class="mt-3 font-mono text-[12px]" style="color: #FFE3D0;">
						{promo.offer}
					</div>
					<button
						type="button"
						class="mt-5 inline-flex items-center gap-2 rounded-full text-[13px] font-semibold"
						style="background: rgba(255,255,255,0.96); color: #141414; padding: 10px 18px;"
					>
						{promo.cta} <ArrowRight size={14} />
					</button>
				</div>
			</div>
		{/key}
	</div>

	<!-- ROI card (tracks the selected goal) -->
	<div class="rounded-xl p-5" style="background: #0a0a0a; border: 1px solid #1E1E1E;">
		<div class="flex items-center justify-between mb-2">
			<div class="font-mono text-[10px] uppercase tracking-[0.24em] text-orange">
				Money made vs money spent
			</div>
			<div
				class="font-mono text-[10px] px-2 py-0.5 rounded-full"
				style="background: rgba(22,163,74,0.14); color: #22C55E; border: 1px solid rgba(22,163,74,0.3);"
			>
				SUCCESS
			</div>
		</div>
		<div
			class="text-cream font-display"
			style="font-size: 26px; letter-spacing: -0.02em; line-height: 1.15;"
		>
			Last promotion made
			<span class="text-orange"> {promo.roi.made}</span> — {promo.roi.people}.
		</div>
		<div class="flex flex-wrap gap-2 mt-4">
			{#each promo.roi.stats as [l, v] (l)}
				<div
					class="px-3 py-1.5 rounded-full font-mono text-[11px]"
					style="background: #0f0f0f; border: 1px solid #1E1E1E;"
				>
					<span class="text-ghost">{l}: </span>
					<span class="text-cream">{v}</span>
				</div>
			{/each}
		</div>
	</div>
</div>
