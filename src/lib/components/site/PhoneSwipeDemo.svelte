<script>
	import { onMount } from 'svelte';
	import {
		Sun,
		BarChart3,
		MessageCircle,
		AlertTriangle,
		Clock,
		Sparkles,
		Mic,
		ArrowRight,
		Send
	} from 'lucide-svelte';
	import { isIndiaRoute } from '@/siteVariant.js';

	const SCREENS = ['morning', 'dashboard', 'ask'];
	const AUTO_MS = 4200;

	let index = $state(0);
	let dragging = $state(false);
	let dx = $state(0);
	let autoOn = $state(true);

	let startX = 0;
	let startY = 0;
	let captured = false;
	let trackRef;
	let widthRef = 0;

	const clamp = (n) => Math.max(0, Math.min(SCREENS.length - 1, n));

	function goTo(i) {
		index = clamp(i);
		dx = 0;
	}

	// Auto-advance until user interacts.
	$effect(() => {
		if (!autoOn) return;
		const t = setInterval(() => {
			index = (index + 1) % SCREENS.length;
		}, AUTO_MS);
		return () => clearInterval(t);
	});

	onMount(() => {
		const measure = () => {
			if (trackRef) widthRef = trackRef.getBoundingClientRect().width;
		};
		measure();
		window.addEventListener('resize', measure);
		return () => window.removeEventListener('resize', measure);
	});

	function onPointerDown(e) {
		dragging = true;
		captured = false;
		startX = e.clientX;
		startY = e.clientY;
	}
	function onPointerMove(e) {
		if (!dragging) return;
		const deltaX = e.clientX - startX;
		const deltaY = e.clientY - startY;
		if (!captured) {
			if (Math.abs(deltaX) > 8 && Math.abs(deltaX) > Math.abs(deltaY)) {
				captured = true;
				autoOn = false;
				try {
					e.currentTarget.setPointerCapture(e.pointerId);
				} catch {
					/* ignore */
				}
			} else if (Math.abs(deltaY) > 10) {
				dragging = false;
				return;
			} else {
				return;
			}
		}
		dx = deltaX;
	}
	function onPointerUp() {
		if (!dragging) return;
		dragging = false;
		if (!captured) {
			dx = 0;
			return;
		}
		const threshold = Math.max(60, widthRef * 0.18);
		if (Math.abs(dx) > threshold) {
			goTo(dx < 0 ? index + 1 : index - 1);
		} else {
			dx = 0;
		}
	}

	let translatePct = $derived(-(index * (100 / SCREENS.length)));
	let dragPx = $derived(dragging ? dx : 0);

	const tabs = [
		{ key: 'morning', label: 'MORNING', Icon: Sun },
		{ key: 'dashboard', label: 'TODAY', Icon: BarChart3 },
		{ key: 'ask', label: 'ASK AI', Icon: MessageCircle }
	];
	const INDIA = isIndiaRoute();

	const dashKpis = INDIA
		? [
				{ l: 'Total Money', v: '₹33,034', d: '-38.8%', down: true },
				{ l: 'Tables served', v: '19', d: '-26.9%', down: true, sub: '19 orders today' },
				{ l: 'Each spend', v: '₹1,743', sub: 'on average' },
				{ l: 'Come back', v: '68%', sub: 'returning' },
				{ l: 'Table Turn', v: '1.19×', sub: 'turns/day' },
				{ l: 'RevPASH', v: '₹34', sub: 'seat · hour' },
				{ l: 'Tips', v: '₹0', sub: 'customer' },
				{ l: 'People', v: '14', sub: 'today' }
			]
		: [
				{ l: 'Total Money', v: '$398', d: '-38.8%', down: true },
				{ l: 'Tables served', v: '19', d: '-26.9%', down: true, sub: '19 orders today' },
				{ l: 'Each spend', v: '$21', sub: 'on average' },
				{ l: 'Come back', v: '68%', sub: 'returning' },
				{ l: 'Table Turn', v: '1.19×', sub: 'turns/day' },
				{ l: 'RevPASH', v: '$0.41', sub: 'seat · hour' },
				{ l: 'Tips', v: '$0', sub: 'customer' },
				{ l: 'People', v: '14', sub: 'today' }
			];

	const morningCards = INDIA
		? [
				{
					i: AlertTriangle,
					tag: 'ACT TODAY',
					color: '#F87171',
					bg: 'rgba(220,38,38,0.10)',
					bd: 'rgba(220,38,38,0.35)',
					title: "63 of your regulars haven't been back this month",
					body: 'Reach out to bring them back before they disappear'
				},
				{
					i: Clock,
					tag: 'HEADS UP',
					color: '#FF6B2B',
					bg: 'rgba(232,80,10,0.12)',
					bd: 'rgba(232,80,10,0.4)',
					title: 'Today is Tuesday — your slowest day',
					body: "Here's how to make more money tonight"
				},
				{
					i: Sparkles,
					tag: 'OPPORTUNITY',
					color: '#22C55E',
					bg: 'rgba(22,163,74,0.10)',
					bd: 'rgba(22,163,74,0.35)',
					title: 'Your best money-maker is missing from promotions',
					body: 'Paneer Tikka Platter · 72% margin · ₹89,723 this month'
				}
			]
		: [
		{
			i: AlertTriangle,
			tag: 'ACT TODAY',
			color: '#F87171',
			bg: 'rgba(220,38,38,0.10)',
			bd: 'rgba(220,38,38,0.35)',
			title: "63 of your regulars haven't been back this month",
			body: 'Reach out to bring them back before they leave'
		},
		{
			i: Clock,
			tag: 'HEADS UP',
			color: '#FF6B2B',
			bg: 'rgba(232,80,10,0.12)',
			bd: 'rgba(232,80,10,0.4)',
			title: 'Today is Tuesday — your slowest day',
			body: "Here's how to make more money tonight"
		},
		{
			i: Sparkles,
			tag: 'OPPORTUNITY',
			color: '#22C55E',
			bg: 'rgba(22,163,74,0.10)',
			bd: 'rgba(22,163,74,0.35)',
			title: 'Your best money-maker is never in your promotions',
			body: 'BLT Sandwich · 72% margin · $1,083 this month'
		}
	];

	const morningPills = INDIA
		? [
				{ l: 'Health', v: '74', c: '#22C55E' },
				{ l: 'Recover', v: '₹34,196', c: '#FF6B2B' },
				{ l: 'To Do', v: '4', c: '#F5F2ED' }
			]
		: [
				{ l: 'Health', v: '74', c: '#22C55E' },
				{ l: 'Recover', v: '$412', c: '#FF6B2B' },
				{ l: 'To Do', v: '4', c: '#F5F2ED' }
			];
</script>

<div id="phone-swipe" data-testid="phone-swipe-section" class="relative flex flex-col items-center">
	<div class="relative">
		<div
			aria-hidden="true"
			class="absolute inset-0 -z-10 pointer-events-none"
			style="filter: blur(60px); background: radial-gradient(closest-side, rgba(232,80,10,0.45), transparent 70%); transform: scale(1.15);"
		></div>

		<!-- Phone shell -->
		<div
			class="relative select-none"
			style="width: min(320px, 88vw); aspect-ratio: 9 / 19; border-radius: 44px; background: linear-gradient(180deg, #1a1a1a 0%, #0a0a0a 100%); padding: 10px; box-shadow: 0 40px 120px -30px rgba(0,0,0,0.7), inset 0 0 0 1.5px rgba(232,80,10,0.22), inset 0 0 0 3px #0a0a0a; touch-action: pan-y;"
		>
			<!-- Screen area (viewport for the swipe track) -->
			<!-- svelte-ignore a11y_no_static_element_interactions -->
			<div
				bind:this={trackRef}
				class="relative w-full h-full overflow-hidden"
				style="border-radius: 34px; cursor: {dragging ? 'grabbing' : 'grab'};"
				onpointerdown={onPointerDown}
				onpointermove={onPointerMove}
				onpointerup={onPointerUp}
				onpointercancel={onPointerUp}
				data-testid="phone-swipe-track"
			>
				<!-- Dynamic-island notch -->
				<div
					aria-hidden="true"
					class="absolute left-1/2 -translate-x-1/2 z-30"
					style="top: 8px; width: 92px; height: 24px; background: #0a0a0a; border-radius: 999px;"
				></div>

				<!-- Track — 3 screens side by side -->
				<div
					class="flex h-full will-change-transform"
					style="width: {SCREENS.length *
						100}%; transform: translate3d(calc({translatePct}% + {dragPx}px), 0, 0); transition: {dragging
						? 'none'
						: 'transform 0.42s cubic-bezier(0.22, 1, 0.36, 1)'};"
				>
					<!-- Morning -->
					<div style="width: {100 / SCREENS.length}%; height: 100%;">
						<div
							class="h-full overflow-hidden flex flex-col"
							style="background: #0a0a0a; color: #F5F2ED;"
							data-testid="phone-screen-morning"
						>
							<div class="px-5 pt-6 pb-3">
								<div
									class="flex items-center gap-2 font-mono uppercase tracking-[0.2em]"
									style="font-size: 9.5px; color: #FF6B2B;"
								>
									<Sun size={11} /> Morning brief · Thu · 07:42
								</div>
								<div class="font-display mt-2" style="font-size: 26px; letter-spacing: -0.03em; line-height: 1.05;">
									Good morning, {INDIA ? 'Aarav' : 'Alex'} <span aria-hidden="true">☀️</span>
								</div>
								<div class="mt-2 text-[12.5px] leading-snug" style="color: #6B6866;">
									Yesterday your restaurant made <span style="color: #F5F2ED;">{INDIA ? '₹2,36,181' : '$2,847'}</span>. Here are
									<span style="color: #F5F2ED;">3 things</span> that need your attention today.
								</div>
							</div>

							<div class="px-4 space-y-2.5 flex-1 overflow-hidden">
								{#each morningCards as c (c.tag)}
									{@const Icon = c.i}
									<div
										class="rounded-xl p-3 flex items-start gap-3"
										style="background: #0f0f0f; border: 1px solid {c.bd};"
									>
										<div
											class="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
											style="background: {c.bg}; border: 1px solid {c.bd}; color: {c.color};"
										>
											<Icon size={14} />
										</div>
										<div class="flex-1 min-w-0">
											<div class="font-mono uppercase tracking-[0.2em]" style="font-size: 8.5px; color: {c.color};">
												{c.tag}
											</div>
											<div class="text-[13px] mt-0.5" style="font-weight: 600;">{c.title}</div>
											<div class="text-[11.5px] mt-0.5" style="color: #6B6866;">{c.body}</div>
										</div>
									</div>
								{/each}
							</div>

							<div class="px-4 pt-3 pb-4 grid grid-cols-3 gap-2">
								{#each morningPills as p (p.l)}
									<div
										class="rounded-lg py-2 px-2.5 text-center"
										style="background: #0f0f0f; border: 1px solid #1E1E1E;"
									>
										<div class="font-mono uppercase tracking-[0.16em]" style="font-size: 8.5px; color: #6B6866;">
											{p.l}
										</div>
										<div class="font-display mt-0.5" style="color: {p.c}; font-size: 18px; letter-spacing: -0.03em;">
											{p.v}
										</div>
									</div>
								{/each}
							</div>
						</div>
					</div>

					<!-- Dashboard (light theme) -->
					<div style="width: {100 / SCREENS.length}%; height: 100%;">
						<div
							class="relative h-full overflow-hidden flex flex-col"
							style="background: #F5F2ED; color: #0a0a0a;"
							data-testid="phone-screen-dashboard"
						>
							<div class="px-4 pt-6 pb-3">
								<div
									class="flex items-center justify-between font-mono uppercase tracking-[0.2em]"
									style="font-size: 9px; color: #6B6866;"
								>
									<span>Today · West Village</span>
									<span class="flex items-center gap-1.5">
										<span class="w-1.5 h-1.5 rounded-full dot-pulse" style="background: #16A34A;"></span>
										<span style="color: #16A34A;">{INDIA ? 'Petpooja · Live' : 'Square · Live'}</span>
									</span>
								</div>
								<div
									class="mt-1"
									style="font-family: Bricolage Grotesque, serif; font-weight: 800; font-size: 22px; letter-spacing: -0.03em;"
								>
									Your numbers, right now
								</div>
							</div>

							<div class="flex-1 overflow-hidden px-3">
								<div class="grid grid-cols-2 gap-2">
									{#each dashKpis as k (k.l)}
										<div
											class="rounded-xl p-2.5"
											style="background: #ffffff; border: 1px solid #eae5df; box-shadow: 0 1px 2px rgba(0,0,0,0.02);"
										>
											<div class="font-mono uppercase tracking-[0.15em]" style="font-size: 8.5px; color: #8a8785;">
												{k.l}
											</div>
											<div class="flex items-baseline gap-1.5 mt-1">
												<div style="font-family: Bricolage Grotesque, serif; font-weight: 800; font-size: 22px; letter-spacing: -0.03em;">
													{k.v}
												</div>
												{#if k.d}
													<div class="font-mono" style="font-size: 10px; color: {k.down ? '#DC2626' : '#16A34A'};">
														{k.d}
													</div>
												{/if}
											</div>
											{#if k.sub}
												<div class="mt-0.5" style="font-size: 10.5px; color: #8a8785;">{k.sub}</div>
											{/if}
										</div>
									{/each}
								</div>
							</div>

							<!-- Floating orange mic -->
							<div class="relative">
								<div
									class="absolute left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full dot-pulse"
									style="width: 56px; height: 56px; bottom: 10px; background: #E8500A; box-shadow: 0 12px 28px -8px rgba(232,80,10,0.55), 0 0 0 6px rgba(232,80,10,0.08); color: #fff;"
									aria-label="Ask JHAX"
									data-testid="phone-dashboard-mic"
								>
									<Mic size={22} />
								</div>
							</div>
							<div style="height: 76px;"></div>
						</div>
					</div>

					<!-- Ask -->
					<div style="width: {100 / SCREENS.length}%; height: 100%;">
						<div
							class="h-full overflow-hidden flex flex-col"
							style="background: #0a0a0a; color: #F5F2ED;"
							data-testid="phone-screen-ask"
						>
							<div class="px-5 pt-6 pb-3">
								<div
									class="flex items-center gap-2 font-mono uppercase tracking-[0.2em]"
									style="font-size: 9.5px; color: #FF6B2B;"
								>
									<MessageCircle size={11} /> Ask JHAX anything
								</div>
								<div class="font-display mt-2" style="font-size: 22px; letter-spacing: -0.03em; line-height: 1.05;">
									What&apos;s on your mind?
								</div>
							</div>

							<div class="flex-1 px-4 space-y-2.5 overflow-hidden">
								<div class="flex justify-end">
									<div
										class="rounded-2xl px-3 py-2 max-w-[80%]"
										style="background: rgba(232,80,10,0.14); border: 1px solid rgba(232,80,10,0.35); color: #FF6B2B; border-bottom-right-radius: 6px; font-size: 13px;"
									>
										Why is money down today?
									</div>
								</div>
								<div class="flex justify-start">
									<div
										class="rounded-2xl px-3 py-2.5 max-w-[85%]"
										style="background: #0f0f0f; border: 1px solid #1E1E1E; border-bottom-left-radius: 6px;"
									>
										<div class="font-mono uppercase tracking-[0.2em] mb-1" style="font-size: 8.5px; color: #FF6B2B;">
											JHAX · 60 sec answer
										</div>
										<div class="text-[13px] leading-snug" style="color: #F5F2ED;">
											It&apos;s about your regulars <span style="color: #FF6B2B;">not coming back</span>.
										</div>
										<div class="text-[11.5px] mt-1.5" style="color: #6B6866;">
											63 regulars haven&apos;t been back in 30 days. Bring back 20% of them and you get
											<span style="color: #F5F2ED;">{INDIA ? '₹30,544' : '$368'}</span> this week.
										</div>
										<div class="mt-2 flex gap-1.5 flex-wrap">
											<span
												class="rounded-full font-mono"
												style="font-size: 9px; padding: 3px 8px; background: #0a0a0a; border: 1px solid #1E1E1E; color: #6B6866;"
											>
												People 63
											</span>
											<span
												class="rounded-full font-mono"
												style="font-size: 9px; padding: 3px 8px; background: #0a0a0a; border: 1px solid #1E1E1E; color: #6B6866;"
											>
												Bring back {INDIA ? '₹30,544' : '$368'}
											</span>
										</div>
										<button
											type="button"
											class="mt-2 inline-flex items-center gap-1 rounded-full"
											style="background: #E8500A; color: #fff; font-size: 11px; padding: 5px 10px; font-weight: 500;"
										>
											Send the message <ArrowRight size={10} />
										</button>
									</div>
								</div>

								<div class="mt-1 space-y-1.5">
									<div class="font-mono uppercase tracking-[0.18em]" style="font-size: 8.5px; color: #6B6866;">
										Try one
									</div>
									<div class="flex flex-wrap gap-1.5">
										{#each ['Who tipped best?', 'Too many staff this week?', 'Best money-making dish?'] as q (q)}
											<span
												class="rounded-full"
												style="font-size: 11px; padding: 5px 10px; background: #0f0f0f; border: 1px solid #1E1E1E; color: #6B6866;"
											>
												{q}
											</span>
										{/each}
									</div>
								</div>
							</div>

							<div class="px-3 pb-4 pt-2">
								<div
									class="flex items-center gap-2 rounded-full pl-3 pr-1 py-1"
									style="background: #0f0f0f; border: 1px solid #1E1E1E;"
								>
									<input
										type="text"
										placeholder="Ask JHAX anything…"
										readonly
										data-testid="phone-ask-input"
										class="flex-1 bg-transparent outline-none"
										style="font-size: 12.5px; color: #F5F2ED;"
									/>
									<button
										type="button"
										class="w-7 h-7 rounded-full flex items-center justify-center"
										style="background: rgba(232,80,10,0.14); border: 1px solid rgba(232,80,10,0.35); color: #FF6B2B;"
										aria-label="Voice"
									>
										<Mic size={13} />
									</button>
									<button
										type="button"
										class="w-7 h-7 rounded-full flex items-center justify-center"
										style="background: #E8500A; color: #fff;"
										aria-label="Send"
									>
										<Send size={12} />
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Bottom tab bar (inside phone, above the screens) -->
				<div
					class="absolute left-0 right-0 flex items-center justify-around z-20"
					style="bottom: 0; height: 56px; background: rgba(10,10,10,0.85); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-top: 1px solid #1E1E1E;"
					data-testid="phone-tab-bar"
				>
					{#each tabs as tab, i (tab.key)}
						{@const Icon = tab.Icon}
						{@const isActive = index === i}
						<button
							type="button"
							onclick={() => {
								autoOn = false;
								goTo(i);
							}}
							data-testid="phone-tab-{tab.key}"
							class="flex flex-col items-center justify-center gap-1 h-full"
							style="color: {isActive ? '#FF6B2B' : '#6B6866'}; transition: color .2s; flex: 1;"
						>
							<Icon size={16} />
							<span class="font-mono" style="font-size: 8.5px; letter-spacing: 0.18em;">{tab.label}</span>
						</button>
					{/each}
				</div>
			</div>
		</div>

		<!-- Progress dots -->
		<div class="mt-8 flex items-center gap-2.5" data-testid="phone-swipe-dots">
			{#each SCREENS as s, i (s)}
				{@const isActive = index === i}
				<button
					type="button"
					onclick={() => {
						autoOn = false;
						goTo(i);
					}}
					data-testid="phone-dot-{s}"
					aria-label="Go to {s} screen"
					class="rounded-full transition-all"
					style="width: {isActive ? 28 : 8}px; height: 8px; background: {isActive
						? '#E8500A'
						: '#333330'}; transition: width .35s cubic-bezier(0.22, 1, 0.36, 1), background .3s;"
				></button>
			{/each}
		</div>

		<!-- Helper caption -->
		<div class="mt-4 font-mono uppercase tracking-[0.22em]" style="font-size: 10px; color: #333330;">
			Swipe · Drag · Tap · Or wait — it auto-advances
		</div>
	</div>
</div>
