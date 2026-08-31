<script>
	import { onMount } from 'svelte';
	import ChapterHeader from './ChapterHeader.svelte';
	import Reveal from './Reveal.svelte';
	import { isIndiaRoute } from '@/siteVariant.js';

	const INDIA = isIndiaRoute();
	const STAGES = [
		{ k: 'SPOTS IT', d: 'Finds the problem before you do' },
		{ k: 'FINDS OUT WHY', d: 'Tells you why in plain English' },
		{ k: 'FIXES IT', d: 'One tap to launch the fix' },
		{ k: 'SENDS IT', d: 'Your message goes out automatically' },
		{ k: 'SHOWS WHAT CAME BACK', d: 'You see the money that came back' }
	];

	const STEP_MS = 1400;
	const PAUSE_MS = 2000;
	const ANIM_MS = STAGES.length * STEP_MS;
	const CYCLE_MS = ANIM_MS + PAUSE_MS;

	// DIAGNOSE is index 1 → competitor bar caps right after DIAGNOSE completes
	// = 2/5 of the loop = 40%
	const COMPETITOR_CAP = 40;

	let tick = $state(0);

	onMount(() => {
		let raf;
		const start = performance.now();
		let last = 0;
		const loop = (now) => {
			const t = (now - start) % CYCLE_MS;
			// Throttle re-renders to ~33ms (~30fps) to keep it smooth but light.
			if (t - last > 30 || t < last) {
				tick = t;
				last = t;
			}
			raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	let inAnimation = $derived(tick < ANIM_MS);
	let stepIdx = $derived(inAnimation ? Math.floor(tick / STEP_MS) : STAGES.length);
	let stepProg = $derived(inAnimation ? (tick % STEP_MS) / STEP_MS : 0);
	let totalProgress = $derived(inAnimation ? (stepIdx + stepProg) / STAGES.length : 1);
	let jhaxWidth = $derived(totalProgress * 100);
	let competitorWidth = $derived(Math.min(totalProgress * 100, COMPETITOR_CAP));
</script>

<section id="loop" data-testid="the-loop" class="relative py-28 md:py-40">
	<ChapterHeader number="06" label="Your Competitive Advantage">
		Every other app tells you
		<br />
		<span class="text-muted-warm">what went wrong.</span>
		<span class="text-orange">JHAX fixes it.</span>
	</ChapterHeader>

	<div class="max-w-[1280px] mx-auto mt-16 px-6 md:px-10">
		<div
			class="relative rounded-2xl p-6 md:p-10 overflow-hidden"
			style="background: linear-gradient(180deg, #0d0d0d 0%, #0a0a0a 100%); border: 1px solid #1E1E1E;"
		>
			<div
				aria-hidden="true"
				class="absolute -top-24 left-1/2 -translate-x-1/2 w-[900px] h-[300px] blur-3xl opacity-40 pointer-events-none"
				style="background: radial-gradient(closest-side, rgba(232,80,10,0.25), transparent);"
			></div>

			<!-- Step cards -->
			<div class="relative grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-3">
				{#each STAGES as s, i (s.k)}
					{@const isActive = inAnimation && i === stepIdx}
					{@const isCompleted = i < stepIdx || !inAnimation}
					{@const cardBg = isActive
						? 'rgba(232,80,10,0.08)'
						: isCompleted
							? '#0f0f0f'
							: '#0c0c0c'}
					{@const cardBorder = isActive
						? 'rgba(232,80,10,0.55)'
						: isCompleted
							? 'rgba(245,242,237,0.18)'
							: '#1E1E1E'}
					{@const labelColor = isActive ? '#FF6B2B' : isCompleted ? '#F5F2ED' : '#3a3835'}
					{@const numColor = isActive ? '#FF6B2B' : isCompleted ? '#8a8785' : '#3a3835'}
					{@const descColor = isActive || isCompleted ? '#6B6866' : '#3a3835'}
					{@const barFillPct = isActive ? stepProg * 100 : isCompleted ? 100 : 0}
					<div
						class="relative rounded-xl p-4 md:p-5 flex flex-col justify-between min-h-[150px] overflow-hidden transition-colors"
						style="background: {cardBg}; border: 1px solid {cardBorder}; box-shadow: {isActive
							? '0 20px 60px -30px rgba(232,80,10,0.55)'
							: 'none'}; transition: background .3s, border-color .3s, box-shadow .3s;"
						data-testid="loop-stage-{s.k}"
						aria-current={isActive ? 'step' : undefined}
					>
						<div>
							<div
								class="font-mono text-[10px] tracking-[0.24em]"
								style="color: {numColor}; transition: color .3s;"
							>
								0{i + 1}
							</div>
							<div
								class="font-display mt-2"
								style="color: {labelColor}; font-size: 24px; letter-spacing: -0.02em; transition: color .3s;"
							>
								{s.k}
							</div>
							<div class="mt-2 text-[13px] leading-snug" style="color: {descColor}; transition: color .3s;">
								{s.d}
							</div>
						</div>

						<!-- Progress bar at bottom -->
						<div
							class="absolute left-0 right-0 bottom-0 h-[3px]"
							style="background: rgba(255,255,255,0.04);"
							data-testid="loop-bar-{s.k}"
						>
							<div
								style="width: {barFillPct}%; height: 100%; background: {isCompleted
									? 'rgba(245,242,237,0.6)'
									: 'linear-gradient(90deg, #E8500A, #FF6B2B)'}; transition: {isActive
									? 'none'
									: 'width .3s, background .3s'};"
							></div>
						</div>

						<!-- Active glow accent -->
						{#if isActive}
							<div
								aria-hidden="true"
								class="absolute -inset-px rounded-xl pointer-events-none"
								style="box-shadow: inset 0 0 40px rgba(232,80,10,0.08);"
							></div>
						{/if}
					</div>
				{/each}
			</div>

			<!-- Competitor comparison bars -->
			<div class="relative mt-10 space-y-5" data-testid="loop-comparison">
				<!-- Competitor POS -->
				<div class="flex items-center gap-4 flex-wrap md:flex-nowrap">
					<div class="w-full md:w-[180px] flex items-center gap-2">
						<span class="font-mono text-[11px] uppercase tracking-[0.16em] text-muted-warm">
							{INDIA ? 'Petpooja / Posist' : 'Square / Toast'}
						</span>
					</div>
					<div
						class="relative flex-1 h-3 rounded-full overflow-hidden"
						style="background: #0f0f0f; border: 1px solid #1E1E1E;"
					>
						<div
							data-testid="competitor-bar-fill"
							style="width: {competitorWidth}%; height: 100%; background: linear-gradient(90deg, #3a3835 0%, #6B6866 100%); transition: width 30ms linear;"
						></div>
						<div
							aria-hidden="true"
							class="absolute top-0 bottom-0"
							style="left: {COMPETITOR_CAP}%; width: 2px; background: rgba(245,242,237,0.15);"
						></div>
					</div>
					<span
						class="font-mono text-[10px] px-2 py-1 rounded-full whitespace-nowrap uppercase tracking-[0.16em]"
						style="background: rgba(220,38,38,0.1); color: #F87171; border: 1px solid rgba(220,38,38,0.3);"
						data-testid="competitor-badge"
					>
						Stops here
					</span>
				</div>

				<!-- JHAX -->
				<div class="flex items-center gap-4 flex-wrap md:flex-nowrap">
					<div class="w-full md:w-[180px] flex items-center gap-2">
						<span class="font-mono text-[11px] uppercase tracking-[0.16em]" style="color: #FF6B2B;">
							JHAX.ai
						</span>
					</div>
					<div
						class="relative flex-1 h-3 rounded-full overflow-hidden"
						style="background: #0f0f0f; border: 1px solid rgba(232,80,10,0.28);"
					>
						<div
							data-testid="jhax-bar-fill"
							style="width: {jhaxWidth}%; height: 100%; background: linear-gradient(90deg, #E8500A 0%, #FF6B2B 100%); box-shadow: 0 0 20px rgba(232,80,10,0.5); transition: width 30ms linear;"
						></div>
					</div>
					<span
						class="font-mono text-[10px] px-2 py-1 rounded-full whitespace-nowrap uppercase tracking-[0.16em]"
						style="background: rgba(232,80,10,0.14); color: #FF6B2B; border: 1px solid rgba(232,80,10,0.4);"
						data-testid="jhax-badge"
					>
						Full loop
					</span>
				</div>
			</div>

			<!-- Callout -->
			<Reveal
				y={20}
				amount={0.4}
				duration={0.7}
				delay={0.4}
				class="mt-8 rounded-xl p-5 md:p-6 relative"
				style="background: #0a0a0a; border: 1px solid #1E1E1E; border-left-width: 3px; border-left-color: #E8500A;"
				testid="loop-callout"
			>
				<div class="font-mono text-[10px] uppercase text-orange tracking-[0.24em] mb-2">
					The difference
				</div>
				<p
					class="text-cream font-display"
					style="font-size: clamp(18px, 2.2vw, 26px); letter-spacing: -0.02em; line-height: 1.3;"
				>
					<em style="font-style: italic; color: #6B6866;">
						{INDIA ? 'Petpooja, Posist, and every other cash register' : 'Square, Toast, and every other cash register'}
					</em>
					show you what went wrong. Then they stop.
					<span class="text-orange">JHAX goes all the way</span> — it finds the problem, explains it,
					fixes it, and shows you the money that came back.
				</p>
			</Reveal>
		</div>
	</div>
</section>
