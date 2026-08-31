<script>
	import { untrack } from 'svelte';
	import { X, Check, TrendingUp } from 'lucide-svelte';
	import ChapterHeader from './ChapterHeader.svelte';
	import Reveal from './Reveal.svelte';
	import { reveal } from '@/actions/reveal.js';
	import { animateValue, EASE_OUT_EXPO } from '@/motion.js';
	import { formatMoney, isIndiaRoute } from '@/siteVariant.js';

	const INDIA = isIndiaRoute();
	const PAIRS = INDIA
		? [
				{
					cost: 40338,
					pain: 'Money drops on Tuesday. You open six different apps trying to figure out why. An hour later — still no clear answer.',
					fix: 'Ask “why is money down?” Get the real answer in 60 seconds. Then fix it with one tap.'
				},
				{
					cost: 28220,
					pain: 'Your accountant flags bloated staffing weeks later. By then, the money is already gone.',
					fix: "Every Monday morning, JHAX tells you exactly where you're overspending — before the week begins."
				},
				{
					cost: 34196,
					pain: 'Your best regular — the one who orders every week — stopped showing up 45 days ago. You had no idea.',
					fix: 'JHAX notices when a regular slips and helps you reach out before they disappear for good.'
				},
				{
					cost: 14940,
					pain: "Building an offer takes two hours across three different apps. By the time it's ready, the slow slot is already gone.",
					fix: 'Under two minutes — message written, creative ready, offer live. All from one screen.'
				},
				{
					cost: 27141,
					pain: "You ran an offer last Tuesday. You still don't know if it brought anyone back.",
					fix: 'See exactly how many people returned and how much money the promotion made. Every single time.'
				},
				{
					cost: 57576,
					pain: `You have too many staff working Tuesday lunch — every single week. That's ${formatMoney(28220)} gone. Every week.`,
					fix: `JHAX catches overstaffing before it costs you. Average saving: ${formatMoney(24900)}–${formatMoney(66400)} every single week.`
				}
			]
		: [
				{
					cost: 486,
					pain: 'Money drops on Tuesday. You open 6 different apps trying to figure out why. An hour later — still no answer.',
					fix: 'Ask “why is money down?” Get the real answer in 60 seconds. Then fix it with one tap.'
				},
				{
					cost: 340,
					pain: 'Your accountant calls three weeks later to say you paid staff too much. That money is already spent.',
					fix: "Every Monday morning, JHAX tells you exactly where you're spending too much — before the week starts."
				},
				{
					cost: 412,
					pain: 'Your best customer — the one who came every week — stopped coming 45 days ago. You had no idea.',
					fix: 'JHAX notices when a regular stops coming and reaches out to them automatically before they leave for good.'
				},
				{
					cost: 180,
					pain: "Making a promotion takes 2 hours across 3 different apps. By the time it's ready, the slow hour is over.",
					fix: 'Under 2 minutes — message written, picture made, offer ready. All from one screen. No switching apps.'
				},
				{
					cost: 327,
					pain: "You sent out an offer last Tuesday. You have no idea if anyone came because of it. You'll never know.",
					fix: 'See exactly how many people came back and how much money your promotion made. Every single time.'
				},
				{
					cost: 694,
					pain: "You have too many staff working Tuesday lunch — every single week. That's $340 gone. Every week.",
					fix: 'JHAX catches overstaffing before it costs you. Average saving: $300–800 every single week.'
				}
			];

	const TOTAL = PAIRS.reduce((a, p) => a + p.cost, 0); // 2,439

	let target = $state(0);
	let display = $state(0);
	let rowInView = $state(PAIRS.map(() => false));
	const revealedSet = new Set();

	function onReveal(i) {
		rowInView[i] = true;
		if (revealedSet.has(i)) return;
		revealedSet.add(i);
		target += PAIRS[i].cost;
	}

	// Animate the display value toward target (mirrors framer-motion animate()).
	$effect(() => {
		const to = target;
		const from = untrack(() => display);
		const stop = animateValue({
			from,
			to,
			duration: 0.9,
			ease: EASE_OUT_EXPO,
			onUpdate: (v) => (display = Math.round(v))
		});
		return stop;
	});

	let pct = $derived(Math.min((display / TOTAL) * 100, 100));

	const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
</script>

<section id="problem" data-testid="problem-section" class="relative py-28 md:py-40">
	<ChapterHeader number="01" label="The Problem">
		Every restaurant owner
		<br />
		<span class="text-muted-warm">is guessing.</span>
		<span class="text-orange">Every day.</span>
	</ChapterHeader>

	<div class="max-w-[1280px] mx-auto mt-14 px-6 md:px-10">
		<!-- Counter banner -->
		<Reveal
			y={16}
			amount={0.4}
			duration={0.7}
			class="relative rounded-2xl p-5 md:p-6 overflow-hidden mb-8"
			style="background: linear-gradient(90deg, #120806 0%, #0a0a0a 100%); border: 1px solid rgba(220,38,38,0.25); box-shadow: 0 20px 60px -30px rgba(220,38,38,0.35);"
			testid="cost-counter-banner"
		>
			<div
				aria-hidden="true"
				class="absolute -top-20 -right-20 w-64 h-64 blur-3xl opacity-40 pointer-events-none"
				style="background: radial-gradient(closest-side, rgba(220,38,38,0.35), transparent);"
			></div>
			<div class="relative flex flex-wrap items-center justify-between gap-4">
				<div class="flex items-center gap-3">
					<div
						class="w-10 h-10 rounded-full flex items-center justify-center"
						style="background: rgba(220,38,38,0.12); border: 1px solid rgba(220,38,38,0.35);"
					>
						<TrendingUp size={18} color="#F87171" style="transform: scaleY(-1);" />
					</div>
					<div>
						<div class="font-mono text-[10.5px] uppercase tracking-[0.22em]" style="color: #F87171;">
							What it&apos;s costing you — weekly
						</div>
						<div
							class="font-display mt-1 text-cream"
							style="font-size: clamp(38px, 5.5vw, 64px); letter-spacing: -0.035em; line-height: 1;"
							data-testid="cost-counter-value"
						>
							{formatMoney(display)}
							<span class="text-muted-warm font-mono ml-2" style="font-size: 14px; letter-spacing: 0.05em;">
								/ week
							</span>
						</div>
					</div>
				</div>
				<div class="w-full md:w-[360px]">
					<div
						class="flex justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-ghost mb-2"
					>
						<span>Bleed detected</span>
						<span>{formatMoney(TOTAL)} / week</span>
					</div>
					<div
						class="h-2 rounded-full overflow-hidden"
						style="background: #0f0f0f; border: 1px solid #1E1E1E;"
					>
						<div
							style="width: {pct}%; height: 100%; background: linear-gradient(90deg, #DC2626, #F87171); box-shadow: 0 0 20px rgba(220,38,38,0.5); transition: width .6s ease-out;"
						></div>
					</div>
				</div>
			</div>
		</Reveal>

		<!-- Column headers -->
		<div class="hidden md:grid md:grid-cols-2 gap-6 mb-4">
			<div class="flex items-center gap-2">
				<span
					class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-mono text-[10px] uppercase tracking-[0.2em]"
					style="background: rgba(220,38,38,0.08); color: #F87171; border: 1px solid rgba(220,38,38,0.25);"
				>
					<X size={12} /> Without JHAX
				</span>
			</div>
			<div class="flex items-center gap-2">
				<span
					class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-mono text-[10px] uppercase tracking-[0.2em]"
					style="background: rgba(232,80,10,0.08); color: #FF6B2B; border: 1px solid rgba(232,80,10,0.35);"
				>
					<Check size={12} /> With JHAX
				</span>
			</div>
		</div>

		<div class="space-y-4 md:space-y-5">
			{#each PAIRS as pair, i (i)}
				<div
					use:reveal={{ amount: 0.35, onReveal: () => onReveal(i) }}
					class="grid md:grid-cols-2 gap-4 md:gap-6"
					data-testid="pair-row-{i}"
				>
					<!-- Pain — slides in from left -->
					<div
						class="rounded-2xl p-5 relative overflow-hidden"
						style="background: linear-gradient(180deg, #100a0a, #0a0a0a); border: 1px solid #1E1414; opacity: {rowInView[
							i
						]
							? 1
							: 0}; transform: translateX({rowInView[i] ? 0 : -40}px); transition: opacity .7s {EASE}, transform .7s {EASE};"
					>
						<div class="flex gap-3">
							<span
								class="flex-shrink-0 mt-1 w-6 h-6 rounded-md flex items-center justify-center"
								style="background: rgba(220,38,38,0.1); border: 1px solid rgba(220,38,38,0.28);"
							>
								<X size={13} color="#F87171" />
							</span>
							<div class="flex-1">
								<p class="text-muted-warm text-[15px] leading-relaxed">{pair.pain}</p>
								<div
									class="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full font-mono text-[10.5px] uppercase tracking-[0.16em]"
									style="background: rgba(220,38,38,0.1); color: #F87171; border: 1px solid rgba(220,38,38,0.3);"
									data-testid="pain-cost-{i}"
								>
									<span>–</span> {formatMoney(pair.cost)} / week
								</div>
							</div>
						</div>
					</div>

					<!-- Fix — slides in from right -->
					<div
						class="rounded-2xl p-5 relative overflow-hidden"
						style="background: linear-gradient(180deg, #0f0d09, #0a0a0a); border: 1px solid rgba(232,80,10,0.25); opacity: {rowInView[
							i
						]
							? 1
							: 0}; transform: translateX({rowInView[i] ? 0 : 40}px); transition: opacity .7s {EASE}, transform .7s {EASE};"
					>
						<div
							aria-hidden="true"
							class="absolute -right-16 -top-16 w-40 h-40 blur-3xl opacity-40 pointer-events-none"
							style="background: radial-gradient(closest-side, rgba(232,80,10,0.35), transparent);"
						></div>
						<div class="relative flex gap-3">
							<span
								class="flex-shrink-0 mt-1 w-6 h-6 rounded-md flex items-center justify-center"
								style="background: rgba(232,80,10,0.14); border: 1px solid rgba(232,80,10,0.35);"
							>
								<Check size={13} color="#FF6B2B" />
							</span>
							<div class="flex-1">
								<p class="text-cream text-[15px] leading-relaxed">{pair.fix}</p>
								<div
									class="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full font-mono text-[10.5px] uppercase tracking-[0.16em]"
									style="background: rgba(22,163,74,0.1); color: #22C55E; border: 1px solid rgba(22,163,74,0.3);"
									data-testid="fix-save-{i}"
								>
									<span>+</span> Saves {formatMoney(pair.cost)} / week
								</div>
							</div>
						</div>
					</div>
				</div>
			{/each}
		</div>
	</div>
</section>
