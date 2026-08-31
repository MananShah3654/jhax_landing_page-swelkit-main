<script>
	import { onMount } from 'svelte';
	import { fly } from 'svelte/transition';
	import { MessageSquare, Users, Utensils, Clock, Megaphone } from 'lucide-svelte';
	import { isIndiaRoute } from '@/siteVariant.js';

	// Tabs = 5 categories. "Ask Anything" is the always-on hub label (default).
	// The other 4 map to a real operator question with a full AI response. The
	// typewriter cycles through those 4 on a 30s countdown; the active tab
	// highlights in sync. Clicking a tab jumps to that question.
	const TABS = [
		{ key: 'ask', label: 'Ask Anything', icon: MessageSquare },
		{ key: 'customers', label: 'Customers', icon: Users },
		{ key: 'menu', label: 'Menu', icon: Utensils },
		{ key: 'labor', label: 'Labor', icon: Clock },
		{ key: 'marketing', label: 'Marketing AI', icon: Megaphone }
	];

	// Only 4 real Q/A pairs — one per tab (excluding "Ask Anything" hub).
	const INDIA = isIndiaRoute();
	const ITEMS = INDIA
		? [
				{
					tab: 'customers',
					question: 'Who are my top 20 customers this month?',
					headline: 'Top 20 = 34% of your revenue',
					delta: '3 regulars slipping',
					body: 'Aarav S. leads at <strong class="text-cream">₹34,196</strong> across 7 visits. 3 of your top 20 haven&apos;t been back in 21 days — reach out before they slip.',
					stats: [
						{ label: 'Regulars', value: '20' },
						{ label: 'Share of money', value: '34%' },
						{ label: 'Not back', value: '3' }
					],
					cta: 'Send the message to those customers'
				},
				{
					tab: 'menu',
					question: 'What dish makes me the most money this week?',
					headline: 'Paneer Tikka Platter: 68% margin',
					delta: '₹1,17,196 earned',
					body: 'Sold <strong class="text-cream">47 units</strong>, contributed <strong class="text-cream">₹1,17,196</strong>. Only appears on 12% of orders — hardly anyone knows about it. Bundle it into a deal to sell more.',
					stats: [
						{ label: 'Margin', value: '68%' },
						{ label: 'Sold', value: '47' },
						{ label: 'Money', value: '₹1,17,196' }
					],
					cta: 'Build a deal'
				},
				{
					tab: 'labor',
					question: 'Do I have too many staff on Tuesday lunch?',
					headline: 'Tue 11–2 has too many staff',
					delta: '–₹28,220 / week',
					body: 'You have <strong class="text-cream">42% more staff</strong> than the Tuesday lunch actually needs. Trim 1 cook + 1 server saves <strong class="text-cream">₹14,67,440/yr</strong> with zero impact on service.',
					stats: [
						{ label: 'Overstaffed', value: '42%' },
						{ label: 'Every week', value: '₹28,220' },
						{ label: 'Every year', value: '₹14,67,440' }
					],
					cta: 'Fix the schedule'
				},
				{
					tab: 'marketing',
					question: 'Which offer brought back the most money?',
					headline: 'WhatsApp offer — Aug 12',
					delta: '₹1,83,762 back',
					body: 'Brought back <strong class="text-cream">₹1,83,762</strong> from <strong class="text-cream">47 people</strong> in 5 days. Cost ₹9,960. Winner — send it again next Tuesday to 63 people who stopped coming.',
					stats: [
						{ label: 'Money back', value: '₹1,83,762' },
						{ label: 'For every ₹1', value: '₹18.40' },
						{ label: 'People', value: '47' }
					],
					cta: 'Send it again'
				}
			]
		: [
				{
					tab: 'customers',
					question: 'Who are my top 20 customers this month?',
					headline: 'Top 20 = 34% of your money',
					delta: '3 regulars slipping',
					body: 'Sarah M. leads at <strong class="text-cream">$412</strong> across 7 visits. 3 of your top 20 haven&apos;t been back in 21 days — reach out before they slip.',
					stats: [
						{ label: 'Regulars', value: '20' },
						{ label: 'Share of money', value: '34%' },
						{ label: 'Not back', value: '3' }
					],
					cta: 'Send the message to those customers'
				},
				{
					tab: 'menu',
					question: 'What dish makes me the most money this week?',
					headline: 'Wagyu Sliders: 68% margin',
					delta: '$1,412 earned',
					body: 'Sold <strong class="text-cream">47 units</strong>, contributed <strong class="text-cream">$1,412</strong>. Only appears on 12% of orders — hardly anyone knows about it. Bundle into a deal to sell more.',
					stats: [
						{ label: 'Margin', value: '68%' },
						{ label: 'Sold', value: '47' },
						{ label: 'Money', value: '$1,412' }
					],
					cta: 'Build a deal'
				},
				{
					tab: 'labor',
					question: 'Do I have too many staff on Tuesday lunch?',
					headline: 'Tue 11–2 has too many staff',
					delta: '–$340 / week',
					body: 'You have <strong class="text-cream">42% more staff</strong> than the Tuesday lunch actually needs. Trim 1 cook + 1 server saves <strong class="text-cream">$17,680/yr</strong> with zero impact on service.',
					stats: [
						{ label: 'Overstaffed', value: '42%' },
						{ label: 'Every week', value: '$340' },
						{ label: 'Every year', value: '$17,680' }
					],
					cta: 'Fix the schedule'
				},
				{
					tab: 'marketing',
					question: 'Which offer brought back the most money?',
					headline: 'WhatsApp offer — Nov 12',
					delta: '$2,214 back',
					body: 'Brought back <strong class="text-cream">$2,214</strong> from <strong class="text-cream">47 people</strong> in 5 days. Cost $120. Winner — send it again next Tuesday to 63 people who stopped coming.',
					stats: [
						{ label: 'Money back', value: '$2,214' },
						{ label: 'For every $1', value: '$18.40' },
						{ label: 'People', value: '47' }
					],
					cta: 'Send it again'
				}
			];

	let idx = $state(0);
	let remaining = $state(30);
	let shown = $state(false);

	let item = $derived(ITEMS[idx]);

	// Typewriter — reruns whenever idx (and thus the question) changes.
	let out = $state('');
	let done = $state(false);
	$effect(() => {
		const text = ITEMS[idx].question;
		out = '';
		done = false;
		let i = 0;
		let cancelled = false;
		const step = () => {
			if (cancelled) return;
			if (i < text.length) {
				i += 1;
				out = text.slice(0, i);
				setTimeout(step, 38);
			} else {
				done = true;
			}
		};
		const t = setTimeout(step, 120);
		return () => {
			cancelled = true;
			clearTimeout(t);
		};
	});

	onMount(() => {
		requestAnimationFrame(() => (shown = true));
		// 30-second countdown; on 0 → next question. Reset on manual tab jump.
		const timer = setInterval(() => {
			if (remaining <= 1) {
				idx = (idx + 1) % ITEMS.length;
				remaining = 30;
			} else {
				remaining = remaining - 1;
			}
		}, 1000);
		return () => clearInterval(timer);
	});

	function jumpToTab(tabKey) {
		if (tabKey === 'ask') return; // hub tab
		const found = ITEMS.findIndex((it) => it.tab === tabKey);
		if (found >= 0) {
			idx = found;
			remaining = 30;
		}
	}

	const slug = (s) => s.toLowerCase().replace(/\s+/g, '-');
</script>

<div
	data-testid="hero-live-demo-card"
	class="relative w-full rounded-[22px] overflow-hidden"
	style="background: linear-gradient(180deg, #131313 0%, #0d0d0d 100%); border: 1px solid #1E1E1E; box-shadow: 0 30px 120px -40px rgba(232,80,10,0.35), 0 0 0 1px rgba(232,80,10,0.12); opacity: {shown
		? 1
		: 0}; transform: translateY({shown ? 0 : 40}px); transition: opacity .9s cubic-bezier(0.22,1,0.36,1) .7s, transform .9s cubic-bezier(0.22,1,0.36,1) .7s;"
>
	<div
		aria-hidden="true"
		class="h-[3px] w-full"
		style="background: linear-gradient(90deg, transparent, #E8500A 30%, #FF6B2B 60%, transparent);"
	></div>

	<div class="p-5 md:p-6">
		<!-- Header — brand + countdown -->
		<div class="flex flex-wrap items-center justify-between gap-3 mb-4">
			<div
				class="flex items-center gap-2 font-mono text-[10.5px] uppercase tracking-[0.16em] text-muted-warm"
			>
				<span class="w-1.5 h-1.5 rounded-full dot-pulse" style="background: #E8500A;"></span>
				<span class="text-orange">JHAX</span>
				<span class="text-ghost">·</span>
				<span>{INDIA ? 'Watching a real India restaurant · Live' : 'Watching a real restaurant · Live'}</span>
			</div>
			<div
				class="font-mono text-[10px] uppercase tracking-[0.16em] text-ghost"
				data-testid="hero-demo-countdown"
			>
				Auto-refresh ·{' '}
				<span class="text-orange" style="min-width: 22px; display: inline-block; text-align: right;">
					{String(remaining).padStart(2, '0')}s
				</span>
			</div>
		</div>

		<!-- Tab bar -->
		<div
			class="flex items-center gap-1.5 p-1.5 rounded-full mb-5 overflow-x-auto"
			style="background: #0a0a0a; border: 1px solid #171717;"
			data-testid="hero-demo-tabs"
			role="tablist"
		>
			{#each TABS as t (t.key)}
				{@const Icon = t.icon}
				{@const isActive = t.key === 'ask' ? false : ITEMS[idx].tab === t.key}
				<button
					type="button"
					onclick={() => jumpToTab(t.key)}
					data-testid="hero-demo-tab-{t.key}"
					role="tab"
					aria-selected={isActive}
					class="flex items-center gap-1.5 px-3 py-1.5 rounded-full whitespace-nowrap transition-all"
					style="background: {isActive
						? 'rgba(232,80,10,0.14)'
						: 'transparent'}; color: {isActive
						? '#FF6B2B'
						: t.key === 'ask'
							? '#6B6866'
							: '#8a8785'}; border: 1px solid {isActive
						? 'rgba(232,80,10,0.4)'
						: 'transparent'}; font-size: 12px; font-family: JetBrains Mono, monospace; letter-spacing: 0.02em;"
				>
					<Icon size={12} />
					{t.label}
				</button>
			{/each}
		</div>

		<!-- Prompt line -->
		<div class="rounded-xl border border-jhax p-4 mb-4" style="background: #0a0a0a;">
			<div class="font-mono text-[9.5px] uppercase text-ghost tracking-[0.18em] mb-2">You ask</div>
			<div
				class="text-cream text-[16px] md:text-[18px] leading-snug"
				style="font-family: Inter, sans-serif; font-weight: 500; letter-spacing: -0.01em; min-height: 30px;"
				data-testid="hero-demo-question"
			>
				&ldquo;{out}{#if !done}<span class="caret"></span>{/if}{#if done}<span>&rdquo;</span>{/if}
			</div>
		</div>

		<!-- AI response -->
		{#key idx}
			<div
				in:fly={{ y: 10, duration: 400, opacity: 0 }}
				class="rounded-xl p-5"
				style="background: #0a0a0a; border: 1px solid #1E1E1E;"
				data-testid="hero-demo-response"
			>
				<div class="flex items-center justify-between mb-2 gap-3">
					<div class="font-mono text-[9.5px] uppercase text-orange tracking-[0.24em]">
						JHAX · Answer
					</div>
					<div
						class="font-mono text-[10px] px-2 py-0.5 rounded-full act-pulse"
						style="background: rgba(232,80,10,0.14); color: #FF6B2B; border: 1px solid rgba(232,80,10,0.4);"
					>
						ACT
					</div>
				</div>

				<div
					class="text-cream font-display"
					style="font-size: clamp(20px, 2.3vw, 26px); letter-spacing: -0.02em; line-height: 1.1;"
				>
					{item.headline}
				</div>
				<div class="font-mono text-[11px] mt-1" style="color: #16A34A;">
					[{item.delta}]
				</div>

				<div class="text-muted-warm text-[14px] leading-relaxed mt-3">
					{@html item.body}
				</div>

				<!-- Stat pills -->
				<div class="flex flex-wrap gap-2 mt-4">
					{#each item.stats as s (s.label)}
						<div
							class="px-3 py-1.5 rounded-full font-mono text-[10.5px]"
							style="background: #0f0f0f; border: 1px solid #1E1E1E;"
							data-testid="hero-demo-stat-{slug(s.label)}"
						>
							<span class="text-ghost">{s.label}: </span>
							<span class="text-cream">{s.value}</span>
						</div>
					{/each}
				</div>

				<button
					type="button"
					data-testid="hero-demo-action-btn"
					class="mt-4 inline-flex items-center gap-2 rounded-full text-[13px] font-medium transition-transform"
					style="background: rgba(232,80,10,0.14); border: 1px solid rgba(232,80,10,0.4); color: #FF6B2B; padding: 9px 16px;"
					onmouseenter={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
					onmouseleave={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
				>
					<span>⚡</span>
					{item.cta}
				</button>
			</div>
		{/key}
	</div>
</div>
