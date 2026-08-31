<script>
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import {
		MessageSquare,
		Activity,
		Target,
		Users,
		Utensils,
		LineChart,
		Clock,
		Building2,
		TrendingUp
	} from 'lucide-svelte';
	import ChapterHeader from './ChapterHeader.svelte';
	import { reveal } from '@/actions/reveal.js';
	import { isIndiaRoute } from '@/siteVariant.js';

	const features = isIndiaRoute()
		? [
				{
					icon: MessageSquare,
					bg: '#E8500A',
					title: 'Ask it anything',
					body: "Type or say any question about your restaurant. Get a clear answer in plain English and one thing to do. Even works while you're on the floor — just press the orange button and talk.",
					tag: 'No one else does this',
					example: 'Try: Why is revenue down today?'
				},
				{
					icon: Activity,
					bg: '#7C3AED',
					title: "Your restaurant's health score",
					body: 'One number from 0 to 100 that tells you if your restaurant is doing well right now. Green means good. Red means fix something today. Simple as that.',
					tag: 'Unique to JHAX',
					example: 'Right now: 51/100 — 3 things to fix'
				},
				{
					icon: Target,
					bg: '#E8500A',
					title: 'Find out why in 60 seconds',
					body: 'Revenue dropped? Instead of spending an hour guessing, ask JHAX. It reads all your numbers and tells you the real reason — in plain English — in under a minute.',
					tag: '60 sec vs. 3 weeks',
					example: 'Reason found: 63 regulars stopped coming'
				},
				{
					icon: Users,
					bg: '#0D9488',
					title: 'Know your customers by name',
					body: "See who your best customers are, how much they've spent, and when they last came in. Get a warning the moment a good customer starts to drift away — before they're gone.",
					tag: "Petpooja can't do this",
					example: 'Aarav Malhotra · ₹94,703 spent · Last visit: today'
				},
				{
					icon: Utensils,
					bg: '#E8500A',
					title: "Find out what's actually making money",
					body: "Not everything on your menu earns the same profit. JHAX shows you what's working — and automatically builds the perfect bundle deal from your best sellers.",
					tag: 'Built by JHAX, priced to sell',
					example: 'Paneer Tikka Platter · 68% margin · 47 sold this week'
				},
				{
					icon: LineChart,
					bg: '#16A34A',
					title: 'See if your promotion worked',
					body: 'After every offer, JHAX shows you exactly how many people came back and how much they spent. No more guessing if it was worth sending.',
					tag: 'Answer → result',
					example: 'WhatsApp offer · +₹1,83,762 · 47 people came back'
				},
				{
					icon: Clock,
					bg: '#D97706',
					title: 'Stop paying for empty shifts',
					body: 'Every Monday morning, JHAX tells you which shifts have too many staff for the expected customers — before the week starts. Most restaurants save ₹24,900–₹66,400 every week just from this.',
					tag: 'Saves ₹33K+ every week',
					example: 'Found: Tuesday lunch overstaffed · ₹28,220 saved'
				},
				{
					icon: Building2,
					bg: '#2563EB',
					title: 'See all your outlets at once',
					body: 'Running more than one location? See them all side by side. Instantly know which one needs your attention today — and why.',
					tag: 'Built for growth',
					example: 'Indiranagar · Bandra · Gurgaon — 3 live'
				},
				{
					icon: TrendingUp,
					bg: '#E8500A',
					title: "Know how much you'll make next month",
					body: "JHAX looks at your patterns and tells you where your money is heading — and gives you specific things to do right now to hit your target before it's too late.",
					tag: 'See it coming',
					example: 'Next month: +₹4,00,000 with the plan'
				}
			]
		: [
		{
			icon: MessageSquare,
			bg: '#E8500A',
			title: 'Ask it anything',
			body: "Type or say any question about your restaurant. Get a clear answer in plain English and one thing to do. Even works while you're cooking — just press the orange button and talk.",
			tag: 'No one else does this',
			example: 'Try: Why is money down today?'
		},
		{
			icon: Activity,
			bg: '#7C3AED',
			title: "Your restaurant's health score",
			body: 'One number from 0 to 100 that tells you if your restaurant is doing well right now. Green means good. Red means fix something today. Simple as that.',
			tag: 'Unique to JHAX',
			example: 'Right now: 51/100 — 3 things to fix'
		},
		{
			icon: Target,
			bg: '#E8500A',
			title: 'Find out why in 60 seconds',
			body: 'Money dropped? Instead of spending an hour guessing, ask JHAX. It reads all your numbers and tells you the real reason — in plain English — in under a minute.',
			tag: '60 sec vs. 3 weeks',
			example: 'Reason found: 63 regulars stopped coming'
		},
		{
			icon: Users,
			bg: '#0D9488',
			title: 'Know your customers by name',
			body: "See who your best customers are, how much they've spent, and when they last came in. Get a warning the moment a good customer starts to drift away — before they're gone.",
			tag: "Square can't do this",
			example: 'Quinn Reyes · $1,141 spent · Last visit: today'
		},
		{
			icon: Utensils,
			bg: '#E8500A',
			title: "Find out what's actually making money",
			body: "Not everything on your menu earns the same profit. JHAX shows you what's working — and automatically builds the perfect bundle deal from your best sellers.",
			tag: 'Built by JHAX, priced to sell',
			example: 'Wagyu Sliders · 68% margin · 47 sold this week'
		},
		{
			icon: LineChart,
			bg: '#16A34A',
			title: 'See if your promotion worked',
			body: 'After every offer, JHAX shows you exactly how many people came back and how much they spent. No more guessing if it was worth sending.',
			tag: 'Answer → result',
			example: 'WhatsApp offer · +$2,214 · 47 people came back'
		},
		{
			icon: Clock,
			bg: '#D97706',
			title: 'Stop paying for empty shifts',
			body: 'Every Monday morning, JHAX tells you which shifts have too many staff for the expected customers — before the week starts. Most restaurants save $300–800 every week just from this.',
			tag: 'Saves $400+ every week',
			example: 'Found: Tuesday lunch overstaffed · $340 saved'
		},
		{
			icon: Building2,
			bg: '#2563EB',
			title: 'See all your restaurants at once',
			body: 'Running more than one location? See them all side by side. Instantly know which one needs your attention today — and why.',
			tag: 'Built for growth',
			example: 'West Village · Downtown · Brooklyn — 3 live'
		},
		{
			icon: TrendingUp,
			bg: '#E8500A',
			title: "Know how much you'll make next month",
			body: "JHAX looks at your patterns and tells you where your money is heading — and gives you specific things to do right now to hit your target before it's too late.",
			tag: 'See it coming',
			example: 'Next month: +$4,820 with the plan'
		}
	];

	let hovered = $state(-1);
	let inView = $state(features.map(() => false));
	let underlineShown = $state(false);

	// The animated underline uses framer `animate` (plays on mount, delay 0.4).
	onMount(() => {
		requestAnimationFrame(() => (underlineShown = true));
	});

	const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
</script>

<section id="features" data-testid="features-section" class="relative py-28 md:py-40">
	<ChapterHeader number="05" label="What JHAX Does">
		Every part of your business.
		<br />
		<span class="text-muted-warm">Watched. Fixed.</span>
		<span class="relative inline-block text-orange">
			Optimized.<span
				aria-hidden="true"
				class="absolute left-0 right-0"
				style="bottom: -0.08em; height: 0.08em; background: linear-gradient(90deg, #E8500A, #FF6B2B 60%, rgba(232,80,10,0)); transform-origin: left center; border-radius: 999px; transform: scaleX({underlineShown
					? 1
					: 0}); transition: transform .8s {EASE} .4s;"
			></span>
		</span>
	</ChapterHeader>

	<div
		class="max-w-[1280px] mx-auto mt-16 px-6 md:px-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5"
	>
		{#each features as f, i (f.title)}
			{@const Icon = f.icon}
			{@const isHovered = hovered === i}
			<div
				use:reveal={{ amount: 0.15, onReveal: () => (inView[i] = true) }}
				role="group"
				onmouseenter={() => (hovered = i)}
				onmouseleave={() => (hovered = -1)}
				class="group rounded-2xl p-6 relative overflow-hidden"
				style="background: #0d0d0d; border: 1px solid {isHovered
					? 'rgba(232,80,10,0.4)'
					: '#1E1E1E'}; opacity: {inView[i] ? 1 : 0}; transform: translateY({inView[i]
					? isHovered
						? -4
						: 0
					: 24}px); box-shadow: {isHovered
					? '0 24px 60px -30px rgba(232,80,10,0.35)'
					: 'none'}; transition: opacity .6s {EASE} {(i % 3) * 0.06}s, transform .25s ease, border-color .25s ease, box-shadow .25s ease;"
				data-testid="feature-card-{i}"
			>
				<div class="flex items-start justify-between mb-5">
					<div
						class="w-11 h-11 rounded-xl flex items-center justify-center"
						style="background: {f.bg}22; border: 1px solid {f.bg}55; color: {f.bg};"
					>
						<Icon size={20} />
					</div>
					<span
						class="font-mono text-[9px] uppercase tracking-[0.18em] px-2 py-1 rounded-full"
						style="color: #FF6B2B; background: rgba(232,80,10,0.08); border: 1px solid rgba(232,80,10,0.28);"
					>
						{f.tag}
					</span>
				</div>
				<h3
					class="font-display text-cream mb-3"
					style="font-size: 22px; letter-spacing: -0.025em; line-height: 1.05;"
				>
					{f.title}
				</h3>
				<p class="text-muted-warm leading-relaxed text-[14.5px]">
					{f.body}
				</p>

				<!-- Hover reveal example -->
				{#if isHovered}
					<div
						transition:slide={{ duration: 280, easing: cubicOut }}
						style="overflow: hidden;"
						data-testid="feature-example-{i}"
					>
						<div
							class="mt-3 pt-3 flex items-center gap-2"
							style="border-top: 1px dashed rgba(232,80,10,0.28);"
						>
							<span
								class="w-1.5 h-1.5 rounded-full dot-pulse flex-shrink-0"
								style="background: #E8500A;"
							></span>
							<span
								class="font-mono text-[12px] leading-snug"
								style="color: #FF6B2B; letter-spacing: 0.005em;"
							>
								{f.example}
							</span>
						</div>
					</div>
				{/if}
			</div>
		{/each}
	</div>
</section>
