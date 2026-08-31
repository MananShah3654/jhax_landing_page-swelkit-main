<script>
	import { Plug, Armchair, Search, Mic } from 'lucide-svelte';
	import ChapterHeader from './ChapterHeader.svelte';
	import Reveal from './Reveal.svelte';
	import PhoneSimulator from './PhoneSwipeDemo.svelte';
	import { reveal } from '@/actions/reveal.js';
	import { isIndiaRoute } from '@/siteVariant.js';

	const INDIA = isIndiaRoute();
	const PROOFS = INDIA
		? [
				{
					icon: Plug,
					title: 'This is connected to Petpooja right now',
					body: '<span class="text-cream">₹33,034</span> isn&apos;t a demo figure — it&apos;s what this restaurant made today. JHAX reads it the moment an order lands. No exports. No spreadsheets. No waiting.'
				},
				{
					icon: Armchair,
					title: '₹34 — the number Petpooja never shows you',
					body: 'It means this restaurant earns <span class="text-cream">₹34</span> per empty seat per hour. The best operators do better. JHAX tells you exactly how to close that gap.'
				},
				{
					icon: Search,
					title: '₹33,034 is down — JHAX already knows the reason',
					body: "It&apos;s not fewer people walking in. 63 regulars from last month just haven&apos;t been back yet. JHAX found this in <span class=\"text-cream\">60 seconds</span> and has the fix ready."
				},
				{
					icon: Mic,
					title: 'That orange button lets you talk to your restaurant',
					body: "Press it and ask anything. Get an answer out loud — while you&apos;re on the floor, in the kitchen, or moving between outlets. No typing needed."
				}
			]
		: [
				{
					icon: Plug,
					title: 'This is connected to Square right now',
					body: '<span class="text-cream">$398</span> isn&apos;t a demo figure — it&apos;s what this restaurant made today. JHAX reads it the moment a customer pays. No exports. No spreadsheets. No waiting.'
				},
				{
					icon: Armchair,
					title: '$0.41 — the number Square never shows you',
					body: 'It means this restaurant earns <span class="text-cream">41 cents</span> per empty seat per hour. The best restaurants make <span class="text-cream">80 cents</span>. JHAX tells you exactly how to close that gap.'
				},
				{
					icon: Search,
					title: '$398 is down — JHAX already knows the reason',
					body: "It&apos;s not fewer people coming in. 63 regulars from last month just haven&apos;t been back yet. JHAX found this in <span class=\"text-cream\">60 seconds</span> and has the fix ready."
				},
				{
					icon: Mic,
					title: 'That orange button lets you talk to your restaurant',
					body: "Press it and ask anything. Get an answer out loud — while you&apos;re cooking, serving, or running between tables. No typing needed."
				}
			];

	let badgeShown = $state(false);
</script>

<section id="proof" data-testid="proof-section" class="relative py-28 md:py-40">
	<ChapterHeader number="02" label="The Proof">
		Not made up.
		<br />
		Not a practice account.
		<br />
		<span class="text-orange">A real restaurant. Today.</span>
	</ChapterHeader>

	<div
		class="max-w-[1280px] mx-auto mt-16 px-6 md:px-10 grid lg:grid-cols-[minmax(0,560px),minmax(0,1fr)] gap-12 md:gap-16 items-center"
	>
		<!-- LEFT — phone frame -->
		<Reveal
			y={30}
			amount={0.2}
			duration={0.9}
			class="relative mx-auto"
			testid="proof-phone"
		>
			<div
				aria-hidden="true"
				class="absolute inset-0 -z-10 pointer-events-none"
				style="filter: blur(60px); background: radial-gradient(closest-side, rgba(232,80,10,0.45), transparent 70%); transform: scale(1.15);"
			></div>

			<!-- Floating LIVE · SQUARE badge -->
			<div
				use:reveal={{ amount: 0.2, onReveal: () => (badgeShown = true) }}
				class="absolute z-20 inline-flex items-center gap-2 rounded-full whitespace-nowrap"
				style="top: -16px; right: -24px; background: rgba(10,10,10,0.85); backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px); border: 1px solid rgba(232,80,10,0.4); padding: 8px 14px; box-shadow: 0 12px 40px -12px rgba(232,80,10,0.55), 0 0 0 1px rgba(232,80,10,0.18); font-family: JetBrains Mono, monospace; font-size: 11px; letter-spacing: 0.18em; text-transform: uppercase; color: #FF6B2B; opacity: {badgeShown
					? 1
					: 0}; transform: translate({badgeShown ? 0 : 12}px, {badgeShown
					? 0
					: -12}px); transition: opacity .6s cubic-bezier(0.22,1,0.36,1) .4s, transform .6s cubic-bezier(0.22,1,0.36,1) .4s;"
				data-testid="proof-live-badge"
			>
				<span class="w-1.5 h-1.5 rounded-full dot-pulse" style="background: #E8500A;"></span>
				{INDIA ? 'LIVE · PETPOOJA' : 'LIVE · SQUARE'}
			</div>

			<PhoneSimulator />
		</Reveal>

		<!-- RIGHT — 4 proof points -->
		<div class="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-5">
			{#each PROOFS as p, i (p.title)}
				{@const Icon = p.icon}
				<Reveal
					y={24}
					amount={0.25}
					delay={i * 0.08}
					class="rounded-2xl p-5"
					style="background: #0d0d0d; border: 1px solid #1E1E1E;"
					testid="proof-point-{i}"
				>
					<div
						class="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
						style="background: rgba(232,80,10,0.14); border: 1px solid rgba(232,80,10,0.35); color: #FF6B2B;"
					>
						<Icon size={18} />
					</div>
					<h3
						class="font-display text-cream mb-2"
						style="font-size: 20px; letter-spacing: -0.02em; line-height: 1.1;"
					>
						{p.title}
					</h3>
					<p class="text-muted-warm text-[14px] leading-relaxed">{@html p.body}</p>
				</Reveal>
			{/each}
		</div>
	</div>

	<!-- Bottom strip -->
	<Reveal
		y={12}
		amount={0.4}
		delay={0.2}
		class="max-w-[1280px] mx-auto mt-14 px-6 md:px-10"
	>
		<div
			class="rounded-2xl sm:rounded-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-x-6 px-5 md:px-6 py-4 sm:py-3"
			style="background: #0a0a0a; border: 1px solid rgba(232,80,10,0.28);"
			data-testid="proof-bottom-strip"
		>
			<div class="flex items-start gap-3 min-w-0">
				<span
					class="w-1.5 h-1.5 rounded-full dot-pulse flex-shrink-0 mt-[7px]"
					style="background: #E8500A;"
				></span>
				<span class="text-[12.5px] md:text-[13px] text-muted-warm" style="line-height: 1.5;">
					{#if INDIA}
						This screenshot was taken from a
						<span class="text-cream">real restaurant in Bengaluru</span> running JHAX on its live stack.
						Numbers update every 30 seconds. Nothing is staged.
					{:else}
						This screenshot was taken from a
						<span class="text-cream">real restaurant in Washington</span> running JHAX on Square.
						Numbers update every 30 seconds. Nothing is staged.
					{/if}
				</span>
			</div>
			<div class="font-mono text-[10.5px] uppercase tracking-[0.24em] sm:flex-shrink-0" style="color: #FF6B2B;">
				Captured · July 2026
			</div>
		</div>
	</Reveal>
</section>
