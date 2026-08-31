<script>
	import { onMount } from 'svelte';
	import LiveDemoCard from './LiveDemoCard.svelte';
	import { isIndiaRoute } from '@/siteVariant.js';

	// Signature on-load moment: line-by-line masked reveal for the headline,
	// staggered fade-up for badge/sub/CTA, Live Demo Card inline (above the fold).
	let shown = $state(false);
	let heroRef;
	let glowY = $state(0);
	let cardY = $state(0);

	const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)';
	const INDIA = isIndiaRoute();

	onMount(() => {
		requestAnimationFrame(() => (shown = true));

		// Scroll parallax — mirrors framer useScroll offset ["start start","end start"]:
		// progress 0 when hero top meets viewport top, 1 when hero bottom does.
		let ticking = false;
		const update = () => {
			ticking = false;
			if (!heroRef) return;
			const rect = heroRef.getBoundingClientRect();
			const h = rect.height || 1;
			const progress = Math.max(0, Math.min(1, -rect.top / h));
			glowY = progress * -140;
			cardY = progress * 60;
		};
		const onScroll = () => {
			if (!ticking) {
				ticking = true;
				requestAnimationFrame(update);
			}
		};
		update();
		window.addEventListener('scroll', onScroll, { passive: true });
		window.addEventListener('resize', onScroll, { passive: true });
		return () => {
			window.removeEventListener('scroll', onScroll);
			window.removeEventListener('resize', onScroll);
		};
	});
</script>

<section
	id="top"
	bind:this={heroRef}
	data-testid="hero-section"
	class="relative pt-[104px] pb-16 md:pt-[112px] md:pb-24 px-6 md:px-10 min-h-screen"
>
	<!-- Ambient orange glow (parallax) -->
	<div
		aria-hidden="true"
		style="transform: translateY({glowY}px);"
		class="absolute inset-0 pointer-events-none"
	>
		<div
			class="absolute right-[-10%] top-20 w-[900px] h-[900px] rounded-full blur-3xl opacity-60"
			style="background: radial-gradient(closest-side, rgba(232,80,10,0.20), transparent);"
		></div>
	</div>

	<!-- Faint grid -->
	<div
		aria-hidden="true"
		class="absolute inset-0 grid-pattern opacity-40 pointer-events-none"
		style="mask-image: radial-gradient(ellipse at center, #000 40%, transparent 75%); -webkit-mask-image: radial-gradient(ellipse at center, #000 40%, transparent 75%);"
	></div>

	<div
		class="relative max-w-[1360px] mx-auto grid grid-cols-1 lg:grid-cols-[minmax(0,1fr),minmax(0,600px)] gap-10 lg:gap-14 items-center"
	>
		<!-- Left column — copy -->
		<div class="text-left">
			<!-- Live badge -->
			<div
				class="inline-flex items-center gap-2 rounded-full font-mono text-[11px] tracking-[0.14em] uppercase"
				style="background: rgba(232,80,10,0.08); border: 1px solid rgba(232,80,10,0.25); color: #FF6B2B; padding: 8px 14px; opacity: {shown
					? 1
					: 0}; transform: translateY({shown ? 0 : 12}px); transition: opacity .6s {EASE} .1s, transform .6s {EASE} .1s;"
				data-testid="hero-live-badge"
			>
				<span class="w-1.5 h-1.5 rounded-full dot-pulse" style="background: #E8500A;"></span>
				{INDIA ? 'LIVE · Watching a real India restaurant right now' : 'LIVE · Watching a real restaurant right now'}
			</div>

			<!-- Headline — masked line reveal -->
			<!-- <h1
				data-testid="hero-headline"
				class="hero-headline mt-5 text-cream"
				style="font-size: clamp(48px, 7.5vw, 96px);"
			>
				<div class="mask-line block">
					<span
						class="inline-block"
						style="transform: translateY({shown ? '0%' : '110%'}); transition: transform .9s {EASE} .2s;"
					>
						Your restaurant
					</span>
				</div>
				<div class="mask-line block">
					<span
						class="inline-block"
						style="transform: translateY({shown ? '0%' : '110%'}); transition: transform .9s {EASE} .26s;"
					>
						has a <span style="color: #E8500A;">new boss</span>.
					</span>
				</div>
			</h1> -->
			<h1
    data-testid="hero-headline"
    class="hero-headline mt-5 text-cream"
    style="font-size: clamp(48px, 7.5vw, 96px);"
>
    <div class="mask-line block">
        <span
            class="inline-block"
            style="transform: translateY({shown ? '0%' : '110%'}); transition: transform .9s {EASE} .2s;"
        >
            {INDIA ? 'Your restaurant in India' : 'Your restaurant'}
        </span>
    </div>
    <div class="mask-line block">
        <span
            class="inline-block"
            style="transform: translateY({shown ? '0%' : '110%'}); transition: transform .9s {EASE} .26s;"
        >
            just got <span style="color: #E8500A;">smarter</span>.
        </span>
    </div>
</h1>

			<!-- Sub -->
			<p
    data-testid="hero-subheadline"
    class="mt-5 text-muted-warm"
    style="font-family: Inter, sans-serif; font-weight: 300; font-size: clamp(16px, 1.4vw, 20px); line-height: 1.55; max-width: 560px; opacity: {shown
        ? 1
        : 0}; transform: translateY({shown ? 0 : 20}px); transition: opacity .7s {EASE} .75s, transform .7s {EASE} .75s;"
>
    {INDIA
		? 'JHAX watches every outlet, every shift, every day. When something is off, it tells you what happened, why it happened, and exactly how to fix it before service slips.'
		: 'JHAX watches every hour, every day. When something\'s off, it tells you what happened, why it happened, and exactly how to fix it — before you even notice.'}
</p>

			<!-- CTAs -->
			<div
				class="mt-7 flex flex-wrap items-center gap-4"
				style="opacity: {shown ? 1 : 0}; transform: translateY({shown
					? 0
					: 18}px); transition: opacity .6s {EASE} .9s, transform .6s {EASE} .9s;"
			>
				<a
					href="#book-demo"
					data-testid="hero-cta-book-demo"
					class="inline-flex items-center gap-2"
					style="background: #E8500A; color: #fff; padding: 16px 34px; border-radius: 100px; font-size: 16px; font-weight: 600; letter-spacing: -0.01em; box-shadow: 0 20px 60px -20px rgba(232,80,10,0.6); transition: transform .2s ease, box-shadow .2s ease;"
					onmouseenter={(e) => {
						e.currentTarget.style.transform = 'translateY(-2px)';
						e.currentTarget.style.boxShadow = '0 28px 72px -20px rgba(232,80,10,0.8)';
					}}
					onmouseleave={(e) => {
						e.currentTarget.style.transform = 'translateY(0)';
						e.currentTarget.style.boxShadow = '0 20px 60px -20px rgba(232,80,10,0.6)';
					}}
				>
					Show Me How It Works <span aria-hidden="true">→</span>
				</a>
				<a
					href="#problem"
					data-testid="hero-secondary-link"
					class="text-muted-warm hover:text-cream transition-colors text-sm"
				>
					See how it works ↓
				</a>
			</div>

			<div
				class="mt-4 font-mono text-[11px] uppercase tracking-[0.18em] text-ghost"
				style="opacity: {shown ? 1 : 0}; transition: opacity .6s {EASE} 1.1s;"
			>
				No credit card · No commitment · Takes 2 minutes
			</div>
		</div>

		<!-- Right column — Live Demo Card -->
		<div class="relative" style="transform: translateY({cardY}px);">
			<LiveDemoCard />
		</div>
	</div>
</section>
