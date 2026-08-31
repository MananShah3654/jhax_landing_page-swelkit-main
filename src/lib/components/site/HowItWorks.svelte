<script>
	import ChapterHeader from './ChapterHeader.svelte';
	import Reveal from './Reveal.svelte';
	import { isIndiaRoute } from '@/siteVariant.js';

	const INDIA = isIndiaRoute();
	const steps = INDIA
		? [
				{
					n: '01',
					title: 'Plug in your Petpooja or Posist',
					body: 'Takes about 15 minutes. JHAX connects to your Petpooja or Posist and starts reading your sales, customers, menu, and channel activity right away. No extra hardware. No ops consultant needed. If you can log into Petpooja, you are ready.'
				},
				{
					n: '02',
					title: "JHAX watches. You don't have to.",
					body: 'Every hour, JHAX checks your numbers. The second something goes wrong — money drops, a regular disappears, or an outlet slips — it tells you exactly what happened and why.'
				},
				{
					n: '03',
					title: 'One tap. Problem handled.',
					body: 'JHAX does not just point at the problem — it helps close it. Tap once to send a message, launch an offer, or tighten a schedule. Then it shows you what money came back.'
				}
			]
		: [
				{
					n: '01',
					title: 'Plug in your Square',
					body: "Takes 15 minutes. JHAX connects to your Square and starts reading your sales, customers, and menu straight away. No extra hardware. No tech person needed. If you can log into Square, you're ready."
				},
				{
					n: '02',
					title: "JHAX watches. You don't have to.",
					body: 'Every hour, JHAX checks your numbers. The second something goes wrong — money drops, a good customer disappears — it tells you exactly what happened and why. Before you even open the app.'
				},
				{
					n: '03',
					title: 'One tap. Problem gone.',
					body: "JHAX doesn't just tell you what's wrong — it fixes it. Tap once to send a message or update a schedule. Then it shows you how much money came back within 48 hours."
				}
			];
</script>

<section id="how" data-testid="how-it-works" class="relative py-28 md:py-40">
	<ChapterHeader number="04" label="How it works">
		From problem detected
		<br />
		to fixed. <span class="text-orange">In minutes.</span>
	</ChapterHeader>

	<div class="relative max-w-[1280px] mx-auto mt-16 px-6 md:px-10">
		<div class="grid md:grid-cols-3 gap-6 md:gap-4 relative">
			{#each steps as s, i (s.n)}
				<Reveal
					y={30}
					delay={i * 0.12}
					amount={0.2}
					duration={0.7}
					class="relative rounded-2xl p-7 md:p-8"
					style="background: linear-gradient(180deg, #0e0e0e 0%, #0a0a0a 100%); border: 1px solid #1E1E1E;"
					testid="step-{s.n}"
				>
					<!-- Clip ONLY the huge watermark number, so the connector arrow isn't clipped. -->
					<div class="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
						<div
							aria-hidden="true"
							class="absolute -right-4 -top-8 font-display select-none"
							style="font-size: 220px; line-height: 1; color: rgba(232,80,10,0.06); letter-spacing: -0.06em;"
						>
							{s.n}
						</div>
					</div>

					<div class="relative">
						<div class="font-mono text-[11px] uppercase tracking-[0.24em] text-orange">
							Step {s.n}
						</div>
						<h3
							class="mt-4 font-display text-cream"
							style="font-size: clamp(26px, 3vw, 34px); letter-spacing: -0.025em; line-height: 1.05;"
						>
							{s.title}
						</h3>
						<p class="mt-4 text-muted-warm leading-relaxed text-[15px]">
							{s.body}
						</p>
					</div>

					{#if i < steps.length - 1}
						<div
							aria-hidden="true"
							class="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 items-center justify-center w-8 h-8 rounded-full z-10"
							style="background: #0a0a0a; border: 1px solid rgba(232,80,10,0.4); color: #E8500A; font-size: 14px;"
						>
							→
						</div>
					{/if}
				</Reveal>
			{/each}
		</div>
	</div>
</section>
