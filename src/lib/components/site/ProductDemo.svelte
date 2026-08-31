<script>
	import { fade } from 'svelte/transition';
	import {
		Mic,
		MessageSquare,
		Users,
		Utensils,
		Megaphone,
		Clock,
		LayoutDashboard,
		ArrowRight,
		Sparkles
	} from 'lucide-svelte';
	import ChapterHeader from './ChapterHeader.svelte';
	import Reveal from './Reveal.svelte';
	import ProductAskTab from './ProductAskTab.svelte';
	import ProductMarketingTab from './ProductMarketingTab.svelte';
	import { isIndiaRoute } from '@/siteVariant.js';

	const TABS = [
		{ key: 'dashboard', label: 'Overview', icon: LayoutDashboard },
		{ key: 'ask', label: 'Ask Anything', icon: MessageSquare },
		{ key: 'customers', label: 'Customers', icon: Users },
		{ key: 'menu', label: 'Menu', icon: Utensils },
		{ key: 'marketing', label: 'Marketing AI', icon: Megaphone },
		{ key: 'labor', label: 'Labor', icon: Clock }
	];

	let active = $state('dashboard');
	const INDIA = isIndiaRoute();

	// --- static data for inline tabs ---
	const dashKpis = INDIA
		? [
				{ label: 'Total Money', value: '₹33,034', delta: '-38.8%', down: true },
				{ label: 'Tables served', value: '19', delta: '-26.9%', down: true },
				{ label: 'Each spend', value: '₹1,743', delta: '-4.1%', down: true },
				{ label: 'Health Score', value: '51/100', tag: 'RED', accent: '#7C3AED' }
			]
		: [
				{ label: 'Total Money', value: '$398', delta: '-38.8%', down: true },
				{ label: 'Tables served', value: '19', delta: '-26.9%', down: true },
				{ label: 'Each spend', value: '$21', delta: '-4.1%', down: true },
				{ label: 'Health Score', value: '51/100', tag: 'RED', accent: '#7C3AED' }
			];
	const dashHealth = [
		{ l: 'Money growth', v: 7 },
		{ l: 'People coming back', v: 100 },
		{ l: 'Staff efficiency', v: 82 }
	];
	const dashQuickAsks = ['Why is money down?', 'Who are my regulars?', 'Do I have too many staff?'];
	const dashAnswers = INDIA
		? {
				'Why is money down?': {
					head: 'Revenue is down 38.8% — it&apos;s not fewer people coming in, it&apos;s <span class="text-orange">your regulars stopped coming back</span>.',
					body: '63 of your best customers haven&apos;t returned in 30 days. Bringing back 20% of them recovers ~<span class="text-cream">₹30,544</span> this week. One tap sends the win-back message to WhatsApp + SMS.'
				},
				'Who are my regulars?': {
					head: 'Your top 20 regulars drive <span class="text-orange">34% of your revenue</span> — and 3 are slipping.',
					body: 'Aarav Malhotra leads at <span class="text-cream">₹94,703</span> across 9 visits. 3 regulars haven&apos;t been in for 21+ days — reach out before they&apos;re gone for good.'
				},
				'Do I have too many staff?': {
					head: 'Yes — <span class="text-orange">Tuesday lunch is 42% overstaffed</span>, every single week.',
					body: 'Trimming 1 cook + 1 server on Tue 11–2 saves <span class="text-cream">₹28,220/week</span> (₹14,67,440/yr) with zero impact on service.'
				}
			}
		: {
				'Why is money down?': {
					head: 'Money is down 38.8% — it&apos;s not fewer people coming in, it&apos;s <span class="text-orange">your regulars stopped coming back</span>.',
					body: '63 of your best customers haven&apos;t returned in 30 days. Bringing back 20% of them recovers ~<span class="text-cream">$368</span> this week. One tap sends the win-back message to WhatsApp + SMS.'
				},
				'Who are my regulars?': {
					head: 'Your top 20 regulars drive <span class="text-orange">34% of your revenue</span> — and 3 are slipping.',
					body: 'Quinn Reyes leads at <span class="text-cream">$1,141</span> across 9 visits. 3 regulars haven&apos;t been in for 21+ days — reach out before they&apos;re gone for good.'
				},
				'Do I have too many staff?': {
					head: 'Yes — <span class="text-orange">Tuesday lunch is 42% overstaffed</span>, every single week.',
					body: 'Trimming 1 cook + 1 server on Tue 11–2 saves <span class="text-cream">$340/week</span> ($17,680/yr) with zero impact on service.'
				}
			};
	let activeAsk = $state('Why is money down?');
	let asking = $state(false);
	let askTimer;
	function askQuestion(q) {
		activeAsk = q;
		asking = true;
		clearTimeout(askTimer);
		askTimer = setTimeout(() => (asking = false), 650);
	}

	const custStats = [
		{ l: 'Total Customers', v: '100', c: '#F5F2ED' },
		{ l: 'Regulars', v: '37', c: '#16A34A' },
		{ l: 'Not back', v: '10', c: '#DC2626' },
		{ l: 'Come-back Rate', v: '68%', c: '#F5F2ED' }
	];
	const custVips = INDIA
		? [
				{ n: 'Aarav Malhotra', v: '₹94,703', visits: '9 visits' },
				{ n: 'Riya Shah', v: '₹88,478', visits: '8 visits' },
				{ n: 'Kabir Mehta', v: '₹68,309', visits: '7 visits' }
			]
		: [
				{ n: 'Quinn Reyes', v: '$1,141', visits: '9 visits' },
				{ n: 'Casey Lopez', v: '$1,066', visits: '8 visits' },
				{ n: 'Sam Nguyen', v: '$823', visits: '7 visits' }
			];
	const custRisks = INDIA
		? [
				{ n: 'Devika Singh', v: '₹68,807', last: '31 days ago' },
				{ n: 'Arjun Kapoor', v: '₹40,338', last: '24 days ago' },
				{ n: 'Neha Verma', v: '₹29,390', last: '22 days ago' }
			]
		: [
				{ n: 'Morgan Singh', v: '$829', last: '31 days ago' },
				{ n: 'Logan Garcia', v: '$486', last: '24 days ago' },
				{ n: 'Elliot Nguyen', v: '$354', last: '22 days ago' }
			];

	const menuProfitable = INDIA
		? [
				{ n: 'Paneer Tikka Platter', v: '₹89,723', m: '72%' },
				{ n: 'Butter Chicken Bowl', v: '₹64,534', m: '68%' },
				{ n: 'Loaded Kathi Roll', v: '₹62,212', m: '64%' }
			]
		: [
				{ n: 'BLT Sandwich', v: '$1,083', m: '72%' },
				{ n: 'Caesar Salad', v: '$779', m: '68%' },
				{ n: 'Cheeseburger', v: '$751', m: '64%' }
			];
	const menuUnder = INDIA
		? [
				{ n: 'Cold Coffee', v: '₹37,490', m: '22%' },
				{ n: 'Chocolate Pastry', v: '₹44,711', m: '31%' }
			]
		: [
				{ n: 'Iced Latte', v: '$452', m: '22%' },
				{ n: 'Chocolate Cake', v: '$539', m: '31%' }
			];

	const laborMetrics = INDIA
		? [
				{ l: 'Staff cost %', v: '38%', sub: 'Target 30%', c: '#DC2626', bad: true },
				{ l: 'Overtime Hours', v: '14 hrs', sub: 'This week', c: '#DC2626', bad: true },
				{ l: 'Money per Staff', v: '₹3,569/hr', sub: 'Above avg', c: '#22C55E', bad: false }
			]
		: [
				{ l: 'Staff cost %', v: '38%', sub: 'Target 30%', c: '#DC2626', bad: true },
				{ l: 'Overtime Hours', v: '14 hrs', sub: 'This week', c: '#DC2626', bad: true },
				{ l: 'Money per Staff', v: '$43/hr', sub: 'Above avg', c: '#22C55E', bad: false }
			];
	const laborShifts = INDIA
		? [
				{ name: 'Tue Lunch — Kitchen', staff: '3 cooks', need: '2', waste: '₹11,786' },
				{ name: 'Wed Dinner — Front', staff: '5 servers', need: '4', waste: '₹7,968' },
				{ name: 'Sat Lunch — Bar', staff: '2 bar', need: '1', waste: '₹6,474' }
			]
		: [
				{ name: 'Tue Lunch — Kitchen', staff: '3 cooks', need: '2', waste: '$142' },
				{ name: 'Wed Dinner — Front', staff: '5 servers', need: '4', waste: '$96' },
				{ name: 'Sat Lunch — Bar', staff: '2 bar', need: '1', waste: '$78' }
			];

	const kpiSlug = (l) => l.toLowerCase().replace(/\s+/g, '-');
</script>

<section id="product" data-testid="product-demo-section" class="relative py-28 md:py-40">
	<ChapterHeader number="03" label="The Product">
		Everything your restaurant needs.
		<br />
		<span class="text-orange">Finally in one place.</span>
	</ChapterHeader>

	<div class="relative max-w-[1280px] mx-auto mt-14 px-4 md:px-10">
		<div
			aria-hidden="true"
			class="absolute left-1/2 -translate-x-1/2 -top-10 w-[1000px] h-[400px] blur-3xl opacity-40 pointer-events-none"
			style="background: radial-gradient(closest-side, rgba(232,80,10,0.22), transparent);"
		></div>

		<Reveal
			y={40}
			amount={0.15}
			duration={0.9}
			class="relative rounded-[22px] overflow-hidden"
			style="background: #0c0c0c; border: 1px solid #1E1E1E; box-shadow: 0 60px 160px -40px rgba(232,80,10,0.25), 0 0 0 1px rgba(255,255,255,0.02);"
			testid="product-mockup"
		>
			<!-- Window chrome -->
			<div
				class="flex items-center gap-3 px-5 py-3 border-b"
				style="border-color: #161616; background: #0a0a0a;"
			>
				<div class="flex gap-1.5">
					<span class="w-2.5 h-2.5 rounded-full" style="background: #242424;"></span>
					<span class="w-2.5 h-2.5 rounded-full" style="background: #242424;"></span>
					<span class="w-2.5 h-2.5 rounded-full" style="background: #242424;"></span>
				</div>
				<div class="font-mono text-[11px] text-ghost">jhax.ai · {INDIA ? 'Indiranagar' : 'West Village'}</div>
				<div class="ml-auto flex items-center gap-2 font-mono text-[10px] text-muted-warm">
					<span class="w-1.5 h-1.5 rounded-full dot-pulse" style="background: #16A34A;"></span>
					{INDIA ? 'Petpooja · Live' : 'Square · Live'}
				</div>
			</div>

			<!-- Tab row -->
			<div class="flex flex-wrap gap-2 px-5 py-3 border-b" style="border-color: #161616;">
				{#each TABS as t (t.key)}
					{@const Icon = t.icon}
					{@const isActive = active === t.key}
					<button
						type="button"
						data-testid="product-tab-{t.key}"
						onclick={() => (active = t.key)}
						class="inline-flex items-center gap-1.5 font-mono text-[11px] px-3 py-1.5 rounded-full uppercase tracking-[0.14em] transition-colors"
						style="background: {isActive
							? 'rgba(232,80,10,0.12)'
							: 'transparent'}; color: {isActive ? '#FF6B2B' : '#6B6866'}; border: 1px solid {isActive
							? 'rgba(232,80,10,0.35)'
							: '#1E1E1E'};"
					>
						<Icon size={12} />
						{t.label}
					</button>
				{/each}
			</div>

			<!-- Content — cross-fade, consistent min-height so no jump -->
			<div class="p-5 md:p-8" style="min-height: 640px;">
				{#key active}
					<div in:fade={{ duration: 300 }} data-testid="product-panel-{active}">
						{#if active === 'dashboard'}
							<!-- DASHBOARD -->
							<div class="grid gap-5">
								<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
									{#each dashKpis as k (k.label)}
										<div
											class="rounded-xl p-4"
											style="background: #0f0f0f; border: 1px solid {k.accent
												? 'rgba(124,58,237,0.35)'
												: '#1E1E1E'};"
											data-testid="kpi-{kpiSlug(k.label)}"
										>
											<div class="font-mono text-[10px] uppercase tracking-[0.2em] text-ghost">
												{k.label}
											</div>
											<div class="flex items-baseline gap-2 mt-2 flex-wrap">
												<div class="font-display text-cream" style="font-size: 30px; letter-spacing: -0.03em;">
													{k.value}
												</div>
												{#if k.delta}
													<div
														class="font-mono text-[11px]"
														style="color: {k.down ? '#DC2626' : '#16A34A'};"
													>
														{k.delta}
													</div>
												{/if}
												{#if k.tag}
													<span
														class="font-mono text-[10px] px-2 py-0.5 rounded-full"
														style="background: rgba(124,58,237,0.12); color: #A78BFA; border: 1px solid rgba(124,58,237,0.35);"
													>
														{k.tag}
													</span>
												{/if}
											</div>
											{#if k.label === 'Health Score'}
												<div class="mt-3 space-y-1.5">
													{#each dashHealth as b (b.l)}
														<div class="flex items-center gap-2">
															<div class="font-mono text-[10px] text-muted-warm w-[110px]">{b.l}</div>
															<div class="flex-1 h-1 rounded-full overflow-hidden" style="background: #1a1a1a;">
																<div
																	class="h-full"
																	style="width: {b.v}%; background: linear-gradient(90deg, #7C3AED, #E8500A);"
																></div>
															</div>
															<div class="font-mono text-[10px] text-cream w-6 text-right">{b.v}</div>
														</div>
													{/each}
												</div>
											{/if}
										</div>
									{/each}
								</div>

								<div
									class="rounded-xl p-4 md:p-5 flex items-center gap-3"
									style="background: linear-gradient(90deg, rgba(232,80,10,0.06), rgba(232,80,10,0.02)); border: 1px solid rgba(232,80,10,0.28);"
								>
									<div
										class="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
										style="background: rgba(232,80,10,0.14); border: 1px solid rgba(232,80,10,0.35);"
									>
										<Mic size={16} color="#FF6B2B" />
									</div>
									<div class="flex-1">
										<div class="text-cream text-[15px] md:text-[17px]" style="font-weight: 500;">
											How is my business today?
										</div>
										<div class="font-mono text-[10px] text-ghost uppercase tracking-[0.18em]">
											Press mic to speak or type
										</div>
									</div>
									<button
										type="button"
										class="hidden md:inline-flex items-center gap-1 px-4 py-2 rounded-full text-[13px] font-medium"
										style="background: #E8500A; color: #fff;"
									>
										Ask →
									</button>
								</div>

								<div class="flex flex-wrap gap-2">
									{#each dashQuickAsks as q, qi (q)}
										{@const on = activeAsk === q}
										<button
											type="button"
											onclick={() => askQuestion(q)}
											data-testid="dash-quickask-{qi}"
											aria-pressed={on}
											class="px-3 py-1.5 rounded-full text-[12px] transition-colors"
											style="border: 1px solid {on ? 'rgba(232,80,10,0.4)' : '#1E1E1E'}; background: {on
												? 'rgba(232,80,10,0.12)'
												: '#0d0d0d'}; color: {on ? '#FF6B2B' : '#6B6866'};"
										>
											{q}
										</button>
									{/each}
								</div>

								<div class="rounded-xl p-5" style="background: #0a0a0a; border: 1px solid #1E1E1E;">
									<div class="flex items-center justify-between mb-2">
										<div class="font-mono text-[10px] uppercase tracking-[0.24em] text-orange">
											JHAX · Live answer
										</div>
										{#if asking}
											<div
												class="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-warm animate-pulse"
												data-testid="dash-answer-thinking"
											>
												Thinking…
											</div>
										{/if}
									</div>
									{#if asking}
										<div class="space-y-2 animate-pulse" data-testid="dash-answer-loading">
											<div style="height: 22px; width: 80%; background: #141414; border-radius: 6px;"></div>
											<div style="height: 14px; width: 96%; background: #121212; border-radius: 6px;"></div>
											<div style="height: 14px; width: 68%; background: #121212; border-radius: 6px;"></div>
										</div>
									{:else}
										<div
											class="text-cream text-[18px] md:text-[22px] font-display"
											style="letter-spacing: -0.02em;"
											data-testid="dash-answer-head"
										>
											{@html dashAnswers[activeAsk].head}
										</div>
										<div class="text-muted-warm mt-2 text-[15px] leading-relaxed">
											{@html dashAnswers[activeAsk].body}
										</div>
									{/if}
								</div>
							</div>
						{:else if active === 'ask'}
							<ProductAskTab />
						{:else if active === 'customers'}
							<!-- CUSTOMERS -->
							<div class="grid gap-5">
								<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
									{#each custStats as s (s.l)}
										<div class="rounded-xl p-4" style="background: #0f0f0f; border: 1px solid #1E1E1E;">
											<div class="font-mono text-[10px] uppercase tracking-[0.2em] text-ghost">{s.l}</div>
											<div
												class="font-display mt-2"
												style="font-size: 30px; letter-spacing: -0.03em; color: {s.c};"
											>
												{s.v}
											</div>
										</div>
									{/each}
								</div>

								<div class="grid md:grid-cols-2 gap-4">
									<div class="rounded-xl p-5" style="background: #0a0a0a; border: 1px solid #1E1E1E;">
										<div class="flex items-center justify-between mb-4">
											<div class="font-mono text-[10px] uppercase tracking-[0.24em] text-orange">
												Top regulars
											</div>
											<div class="font-mono text-[10px] uppercase tracking-[0.18em] text-ghost">
												This month
											</div>
										</div>
										<ul class="space-y-3">
											{#each custVips as v, i (v.n)}
												<li
													class="flex items-center justify-between rounded-lg px-3 py-2.5"
													style="background: #0f0f0f; border: 1px solid #171717;"
												>
													<div class="flex items-center gap-3">
														<div
															class="w-7 h-7 rounded-full flex items-center justify-center font-mono text-[11px]"
															style="background: rgba(22,163,74,0.14); color: #22C55E; border: 1px solid rgba(22,163,74,0.3);"
														>
															{i + 1}
														</div>
														<div>
															<div class="text-cream text-[14.5px]" style="font-weight: 500;">{v.n}</div>
															<div class="font-mono text-[10px] text-ghost uppercase tracking-[0.16em]">
																{v.visits}
															</div>
														</div>
													</div>
													<div class="text-cream font-mono text-[13px]">{v.v}</div>
												</li>
											{/each}
										</ul>
									</div>

									<div class="rounded-xl p-5" style="background: #0a0a0a; border: 1px solid #1E1E1E;">
										<div class="flex items-center justify-between mb-4">
											<div class="font-mono text-[10px] uppercase tracking-[0.24em]" style="color: #DC2626;">
												Not back yet
											</div>
											<div class="font-mono text-[10px] uppercase tracking-[0.18em] text-ghost">
												Last visit
											</div>
										</div>
										<ul class="space-y-3">
											{#each custRisks as v (v.n)}
												<li
													class="flex items-center justify-between rounded-lg px-3 py-2.5"
													style="background: #0f0f0f; border: 1px solid #171717;"
												>
													<div class="flex items-center gap-3">
														<div
															class="w-7 h-7 rounded-full flex items-center justify-center"
															style="background: rgba(220,38,38,0.12); color: #F87171; border: 1px solid rgba(220,38,38,0.35); font-size: 12px;"
														>
															!
														</div>
														<div>
															<div class="text-cream text-[14.5px]" style="font-weight: 500;">{v.n}</div>
															<div class="font-mono text-[10px] text-ghost uppercase tracking-[0.16em]">
																Last: {v.last}
															</div>
														</div>
													</div>
													<div class="text-muted-warm font-mono text-[13px]">{v.v}</div>
												</li>
											{/each}
										</ul>
										<button
											type="button"
											class="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-full text-[13px] font-medium"
											style="background: #E8500A; color: #fff; padding: 10px 20px;"
										>
											Send the message to those customers <ArrowRight size={14} />
										</button>
									</div>
								</div>
							</div>
						{:else if active === 'menu'}
							<!-- MENU -->
							<div class="grid gap-5">
								<div class="grid md:grid-cols-2 gap-4">
									<div class="rounded-xl p-5" style="background: #0a0a0a; border: 1px solid #1E1E1E;">
										<div class="font-mono text-[10px] uppercase tracking-[0.24em] text-orange mb-4">
											Most Profitable
										</div>
										<ul class="space-y-3">
											{#each menuProfitable as p, i (p.n)}
												<li
													class="flex items-center justify-between rounded-lg px-3 py-2.5"
													style="background: #0f0f0f; border: 1px solid #171717;"
												>
													<div class="flex items-center gap-3">
														<div
															class="w-7 h-7 rounded-full flex items-center justify-center font-mono text-[11px]"
															style="background: rgba(22,163,74,0.14); color: #22C55E; border: 1px solid rgba(22,163,74,0.3);"
														>
															{i + 1}
														</div>
														<div>
															<div class="text-cream text-[14.5px]" style="font-weight: 500;">{p.n}</div>
															<div class="font-mono text-[10px] text-ghost uppercase tracking-[0.16em]">
																Margin {p.m}
															</div>
														</div>
													</div>
													<div class="text-cream font-mono text-[13px]">{p.v}</div>
												</li>
											{/each}
										</ul>
									</div>
									<div class="rounded-xl p-5" style="background: #0a0a0a; border: 1px solid #1E1E1E;">
										<div
											class="font-mono text-[10px] uppercase tracking-[0.24em]"
											style="color: #DC2626; margin-bottom: 16px;"
										>
											Underperforming
										</div>
										<ul class="space-y-3">
											{#each menuUnder as p (p.n)}
												<li
													class="flex items-center justify-between rounded-lg px-3 py-2.5"
													style="background: #0f0f0f; border: 1px solid #171717;"
												>
													<div>
														<div class="text-cream text-[14.5px]" style="font-weight: 500;">{p.n}</div>
														<div class="font-mono text-[10px] text-ghost uppercase tracking-[0.16em]">
															Margin {p.m}
														</div>
													</div>
													<div class="text-muted-warm font-mono text-[13px]">{p.v}</div>
												</li>
											{/each}
										</ul>
									</div>
								</div>

								<div
									class="rounded-xl p-5 relative overflow-hidden"
									style="background: linear-gradient(120deg, rgba(232,80,10,0.06), rgba(232,80,10,0.01)); border: 1px solid rgba(232,80,10,0.35);"
								>
									<div class="flex items-center gap-2 mb-3">
										<Sparkles size={14} color="#FF6B2B" />
										<div class="font-mono text-[10px] uppercase tracking-[0.24em] text-orange">
											AI Combo Builder
										</div>
									</div>
									<div class="text-cream font-display" style="font-size: 26px; letter-spacing: -0.02em;">
										Bistro Deal
									</div>
									<div class="text-muted-warm text-[15px] mt-1">
										{INDIA ? 'Paneer Burger + Peri Peri Fries + Cold Coffee' : 'Cheeseburger + Truffle Fries + Iced Latte'}
									</div>
									<div class="flex flex-wrap items-center gap-4 mt-3">
										<div class="text-cream font-display" style="font-size: 30px; letter-spacing: -0.03em;">
											{INDIA ? '₹799' : '$21.99'}
										</div>
										<div
											class="font-mono text-[11px] px-2 py-1 rounded-full"
											style="background: rgba(22,163,74,0.14); color: #22C55E; border: 1px solid rgba(22,163,74,0.3);"
										>
											Save 5.4%
										</div>
										<div class="font-mono text-[11px] text-ghost">Lifts attach rate ~+18%</div>
									</div>
									<button
										type="button"
										class="mt-4 inline-flex items-center gap-2 rounded-full text-[13px] font-medium"
										style="background: #E8500A; color: #fff; padding: 10px 20px;"
									>
										Build a deal <ArrowRight size={14} />
									</button>
								</div>
							</div>
						{:else if active === 'marketing'}
							<ProductMarketingTab />
						{:else if active === 'labor'}
							<!-- LABOR -->
							<div class="grid gap-5">
								<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
									{#each laborMetrics as m (m.l)}
										<div
											class="rounded-xl p-4"
											style="background: #0f0f0f; border: 1px solid {m.bad
												? 'rgba(220,38,38,0.3)'
												: 'rgba(22,163,74,0.28)'};"
										>
											<div class="font-mono text-[10px] uppercase tracking-[0.2em] text-ghost">{m.l}</div>
											<div class="flex items-baseline gap-2 mt-2 flex-wrap">
												<div class="font-display" style="font-size: 30px; letter-spacing: -0.03em; color: {m.c};">
													{m.v}
												</div>
												<div class="font-mono text-[11px] text-muted-warm">{m.sub}</div>
											</div>
										</div>
									{/each}
								</div>

								<div class="rounded-xl p-5" style="background: #0a0a0a; border: 1px solid #1E1E1E;">
									<div class="flex items-center justify-between mb-4 flex-wrap gap-2">
										<div>
											<div class="font-mono text-[10px] uppercase tracking-[0.24em] text-orange">
												Monday Morning Report
											</div>
											<div class="text-cream font-display mt-1" style="font-size: 22px; letter-spacing: -0.02em;">
												3 overstaffed shifts this week
											</div>
										</div>
										<div
											class="font-mono text-[10px] px-2 py-0.5 rounded-full"
											style="background: rgba(220,38,38,0.12); color: #F87171; border: 1px solid rgba(220,38,38,0.3);"
										>
											{INDIA ? '₹26,230 waste' : '$316 waste'}
										</div>
									</div>
									<ul class="space-y-3">
										{#each laborShifts as s (s.name)}
											<li
												class="flex items-center justify-between rounded-lg px-3 py-3"
												style="background: #0f0f0f; border: 1px solid #171717;"
											>
												<div>
													<div class="text-cream text-[14.5px]" style="font-weight: 500;">{s.name}</div>
													<div class="font-mono text-[10px] text-ghost uppercase tracking-[0.16em]">
														{s.staff} scheduled · needs {s.need}
													</div>
												</div>
												<div class="font-mono text-[13px]" style="color: #F87171;">{s.waste}</div>
											</li>
										{/each}
									</ul>
									<button
										type="button"
										class="mt-4 inline-flex items-center gap-2 rounded-full text-[13px] font-medium"
										style="background: #E8500A; color: #fff; padding: 10px 20px;"
									>
										Adjust the schedule <ArrowRight size={14} />
									</button>
								</div>
							</div>
						{/if}
					</div>
				{/key}
			</div>
		</Reveal>

		<div
			class="mt-6 flex flex-wrap justify-between gap-4 font-mono text-[10px] uppercase tracking-[0.22em] text-ghost px-2"
		>
			<span>{INDIA ? 'fig. 02 — live screen, indiranagar · aug 18' : 'fig. 02 — live screen, west village · nov 24'}</span>
			<span>frame 001 / 003</span>
		</div>
	</div>
</section>
