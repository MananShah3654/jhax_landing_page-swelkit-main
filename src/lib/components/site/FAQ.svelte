<script>
	import { slide } from 'svelte/transition';
	import { cubicOut } from 'svelte/easing';
	import { Plus, Minus } from 'lucide-svelte';
	import ChapterHeader from './ChapterHeader.svelte';
	import { isIndiaRoute } from '@/siteVariant.js';

	const faqs = isIndiaRoute()
		? [
				{
					q: 'We already use Petpooja or Posist. Do we have to switch?',
					a: 'No — you keep Petpooja or Posist exactly as it is. JHAX connects to it and makes it smarter. Think of Petpooja as the cash register and JHAX as the business brain sitting on top. Setup takes about 15 minutes.'
				},
				{
					q: "Is this hard to use? I'm not a tech person.",
					a: "If you can send a WhatsApp message, you can use JHAX. Just type or say a question — like 'why is money down today?' — and JHAX answers in plain English. No charts to decode. No reports to build."
				},
				{
					q: 'What if I only have one outlet?',
					a: 'JHAX works just as well for one outlet as it does for fifteen. In fact, single-location operators usually see the fastest result because every answer turns into action immediately.'
				},
				{
					q: 'How fast will I see results?',
					a: 'Most restaurant operators get their first useful answer within 24 hours of connecting. Promotion results — who came back and how much they spent — usually show up within 48 hours of sending.'
				},
				{
					q: 'Is my customer information safe?',
					a: "Yes. Your information is protected with bank-level security. We never sell it, never share it, and never use it for anything other than helping your specific restaurant."
				},
				{
					q: 'How much does it cost?',
					a: 'Plans start at ₹24,900 a month. Most restaurants make that back quickly just from catching regulars who are slipping and fixing overstaffed shifts. Book a demo and we will show you the math for your setup.'
				},
				{
					q: "Can I cancel if I don't like it?",
					a: "Yes, anytime. No lock-in contracts. No penalty. We're confident enough in what JHAX does that we don't need to trap you."
				},
				{
					q: 'Still have a question?',
					a: "We'll answer it live on the demo call. Book a free 20-minute session and ask us anything — about the product, the price, or how it works for your restaurant."
				}
			]
		: [
				{
					q: 'We already use Square. Do we have to switch?',
					a: 'No — you keep Square exactly as it is. JHAX connects to your Square and makes it smarter. Think of Square as the cash register and JHAX as the business brain sitting on top. Setup takes about 15 minutes.'
				},
				{
					q: "Is this hard to use? I'm not a tech person.",
					a: "If you can send a WhatsApp message, you can use JHAX. Just type or say a question — like 'why is money down today?' — and JHAX answers in plain English. No charts to figure out. No reports to build. No tech knowledge needed."
				},
				{
					q: 'What if I only have one location?',
					a: 'JHAX works just as well for one restaurant as it does for five. In fact, single-location owners usually see the biggest results fastest — because every answer goes directly into one place.'
				},
				{
					q: 'How fast will I see results?',
					a: 'Most restaurant owners get their first useful answer within 24 hours of connecting. Promotion results — how many people came back and how much they spent — show up within 48 hours of sending.'
				},
				{
					q: 'Is my customer information safe?',
					a: "Yes. Your information is locked with bank-level security. We never sell it, never share it, and never use it for anything other than helping your specific restaurant. It's yours — always."
				},
				{
					q: 'How much does it cost?',
					a: "Plans start at $299 a month. Most restaurants make that back in the first week just from finding customers who haven't come back and fixing overstaffed shifts. Book a demo and we'll show you the math for your restaurant specifically."
				},
				{
					q: "Can I cancel if I don't like it?",
					a: "Yes, anytime. No contracts. No penalty. One click and you're done. We're confident enough in what JHAX does that we don't need to lock you in."
				},
				{
					q: 'Still have a question?',
					a: "We'll answer it live on the demo call. Book a free 20-minute session and ask us anything — about the product, the price, how it works for your specific restaurant. No pressure."
				}
			];

	let open = $state(0);
</script>

<section id="faq" data-testid="faq-section" class="relative py-28 md:py-40">
	<ChapterHeader number="07" label="Common Questions">
		Things people
		<br />
		<span class="text-orange">always ask us.</span>
	</ChapterHeader>

	<div class="max-w-[900px] mx-auto mt-14 px-6 md:px-10">
		<div class="divide-y" style="border-color: #1E1E1E;">
			{#each faqs as f, i (f.q)}
				{@const isOpen = open === i}
				<div
					class="py-5"
					style="border-top: {i === 0 ? '1px solid #1E1E1E' : 'none'}; border-bottom: 1px solid #1E1E1E;"
				>
					<button
						type="button"
						onclick={() => (open = isOpen ? -1 : i)}
						data-testid="faq-toggle-{i}"
						class="w-full flex items-center justify-between text-left gap-6"
					>
						<span
							class="text-cream"
							style="font-family: Inter, sans-serif; font-weight: 500; font-size: clamp(17px, 1.6vw, 20px); letter-spacing: -0.01em;"
						>
							{f.q}
						</span>
						<span
							class="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center transition-transform"
							style="background: {isOpen
								? 'rgba(232,80,10,0.14)'
								: '#0f0f0f'}; border: 1px solid {isOpen
								? 'rgba(232,80,10,0.4)'
								: '#1E1E1E'}; color: {isOpen ? '#FF6B2B' : '#6B6866'};"
						>
							{#if isOpen}
								<Minus size={16} />
							{:else}
								<Plus size={16} />
							{/if}
						</span>
					</button>
					{#if isOpen}
						<div
							transition:slide={{ duration: 350, easing: cubicOut }}
							style="overflow: hidden;"
						>
							<p
								class="mt-4 text-muted-warm leading-relaxed"
								style="font-size: 16px; max-width: 720px;"
								data-testid="faq-answer-{i}"
							>
								{f.a}
							</p>
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</section>
