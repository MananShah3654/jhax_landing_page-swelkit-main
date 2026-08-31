<script>
	import { ArrowRight } from 'lucide-svelte';
	import { Mic } from 'lucide-svelte';
	import { isIndiaRoute } from '@/siteVariant.js';

	const INDIA = isIndiaRoute();
	const askQuestions = INDIA
		? [
				'Why is revenue down 38.8% today?',
				'Which of my 3 outlets needs my help?',
				'Do I have too many staff Tuesday lunch?',
				'Who are my top 20 customers this month?'
			]
		: [
				'Why is money down 38.8% today?',
				'Which of my 3 restaurants needs my help?',
				'Do I have too many staff Tuesday lunch?',
				'Who are my top 20 customers this month?'
			];

	let q = $state(0);
	let text = $state('');
	let done = $state(false);

	$effect(() => {
		const current = askQuestions[q];
		text = '';
		done = false;
		let i = 0;
		let cancelled = false;
		let advance;
		const step = () => {
			if (cancelled) return;
			if (i < current.length) {
				i += 1;
				text = current.slice(0, i);
				setTimeout(step, 40);
			} else {
				done = true;
				advance = setTimeout(() => {
					if (!cancelled) q = (q + 1) % askQuestions.length;
				}, 2400);
			}
		};
		const t = setTimeout(step, 120);
		return () => {
			cancelled = true;
			clearTimeout(t);
			clearTimeout(advance);
		};
	});
</script>

<div class="grid gap-5">
	<div
		class="rounded-xl p-5"
		style="background: linear-gradient(90deg, rgba(232,80,10,0.05), transparent); border: 1px solid rgba(232,80,10,0.28);"
	>
		<div class="flex items-center gap-3 mb-3">
			<div
				class="w-9 h-9 rounded-full flex items-center justify-center"
				style="background: rgba(232,80,10,0.14); border: 1px solid rgba(232,80,10,0.35);"
			>
				<Mic size={16} color="#FF6B2B" />
			</div>
			<div class="font-mono text-[10px] uppercase tracking-[0.24em] text-ghost">Owner asks</div>
		</div>
		<div
			class="text-cream text-[22px] md:text-[26px] font-display"
			style="letter-spacing: -0.02em; min-height: 36px;"
		>
			&ldquo;{text}{#if !done}<span class="caret"></span>{/if}{#if done}<span>&rdquo;</span>{/if}
		</div>
	</div>

	<div class="rounded-xl p-5" style="background: #0a0a0a; border: 1px solid #1E1E1E;">
		<div class="flex items-center justify-between mb-2">
			<div class="font-mono text-[10px] uppercase tracking-[0.24em] text-orange">JHAX · Answer</div>
			<div
				class="font-mono text-[10px] px-2 py-0.5 rounded-full act-pulse"
				style="background: rgba(232,80,10,0.14); color: #FF6B2B; border: 1px solid rgba(232,80,10,0.4);"
			>
				ACT
			</div>
		</div>
		<div class="text-cream font-display" style="font-size: 26px; letter-spacing: -0.02em; line-height: 1.1;">
			{INDIA ? 'It&apos;s about your regulars, not new orders.' : 'It&apos;s about your regulars, not new people.'}
		</div>
		<div class="font-mono text-[11px] mt-1" style="color: #16A34A;">
			{INDIA ? '[+₹30,544 this week if we bring them back]' : '[+$368 this week if we bring them back]'}
		</div>
		<p class="text-muted-warm mt-3 text-[15px] leading-relaxed">
			63 of your best customers haven&apos;t returned in 30 days. Bringing back 20% of them recovers ~<span
				class="text-cream">{INDIA ? '₹30,544' : '$368'}</span
			> this week. One tap sends the message on WhatsApp + SMS.
		</p>
		<div class="flex flex-wrap gap-2 mt-4">
			{#each [['Not back', '63'], ['Est. recovery', INDIA ? '₹30,544' : '$368'], ['Response time', '60 sec']] as [l, v] (l)}
				<div
					class="px-3 py-1.5 rounded-full font-mono text-[11px]"
					style="background: #0f0f0f; border: 1px solid #1E1E1E;"
				>
					<span class="text-ghost">{l}: </span>
					<span class="text-cream">{v}</span>
				</div>
			{/each}
		</div>
		<button
			type="button"
			class="mt-4 inline-flex items-center gap-2 rounded-full text-[13px] font-medium"
			style="background: #E8500A; color: #fff; padding: 10px 20px;"
		>
			Launch Win-Back <ArrowRight size={14} />
		</button>
	</div>
</div>
