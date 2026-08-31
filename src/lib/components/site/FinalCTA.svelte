<script>
	import { onDestroy } from 'svelte';
	import { fade } from 'svelte/transition';
	import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-svelte';
	import Reveal from './Reveal.svelte';
	import { saveLead } from '@/leads.js';
	import { isIndiaRoute } from '@/siteVariant.js';

	let email = $state('');
	let status = $state('idle'); // idle | loading | success | error
	let message = $state('');

	const validate = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

	// The success banner clears itself after 5s. One managed timer so back-to-back
	// submits can't leave an older timeout to hide the newer message early.
	const SUCCESS_TTL = 5000;
	let successTimer = null;
	function showSuccess(msg) {
		clearTimeout(successTimer);
		status = 'success';
		message = msg;
		email = ''; // input goes back to empty + plain placeholder
		successTimer = setTimeout(() => {
			status = 'idle';
			message = '';
		}, SUCCESS_TTL);
	}
	onDestroy(() => clearTimeout(successTimer));

	// Remember emails submitted from THIS browser so re-submitting the same address
	// shows a friendly "already on our list" message instead of creating a duplicate
	// lead. (Firestore rules block clients from reading leads, so cross-device dedup
	// isn't possible without a backend — this handles the common repeat-submit case.)
	const SUBMITTED_KEY = 'jhax_lead_emails';
	function submittedEmails() {
		try {
			return new Set(JSON.parse(localStorage.getItem(SUBMITTED_KEY) || '[]'));
		} catch {
			return new Set();
		}
	}
	function rememberEmail(e) {
		try {
			const s = submittedEmails();
			s.add(e);
			localStorage.setItem(SUBMITTED_KEY, JSON.stringify([...s]));
		} catch {
			/* storage disabled / private mode — non-fatal */
		}
	}

	async function submit(e) {
		e?.preventDefault();
		if (status === 'loading') return;

		if (!validate(email.trim())) {
			clearTimeout(successTimer);
			status = 'error';
			message = 'Please enter a valid email address';
			return;
		}
		const norm = email.trim().toLowerCase();
		if (submittedEmails().has(norm)) {
			showSuccess("You're already on our list! We'll be in touch within 24 hours");
			return;
		}
		status = 'loading';
		message = '';
		try {
			await saveLead({ email: norm, source: 'final_cta' });
			rememberEmail(norm);
			showSuccess("You're on the list! We'll be in touch within 24 hours");
		} catch (err) {
			// eslint-disable-next-line no-console
			console.error('[leads] Firestore write failed:', err?.code || '', err?.message || err);
			status = 'error';
			message = 'Something went wrong. Please try again.';
		}
	}

	// The input only ever signals state through its border — the actual error and
	// success copy lives in its own banner below the form, never in the placeholder.
	let borderColor = $derived(status === 'error' ? '#DC2626' : 'rgba(255,255,255,0.10)');
	const INDIA = isIndiaRoute();
	const trust = INDIA
		? ['No credit card', 'No commitment', 'See a real India restaurant live', '20 minutes']
		: ['No credit card', 'No commitment', 'See a real restaurant live', '20 minutes'];
</script>

<section id="book-demo" data-testid="final-cta" class="relative py-28 md:py-40 overflow-hidden">
	<!-- Ambient glow -->
	<div
		aria-hidden="true"
		class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1200px] h-[600px] blur-3xl opacity-50 pointer-events-none"
		style="background: radial-gradient(closest-side, rgba(232,80,10,0.22), transparent);"
	></div>

	<div class="relative max-w-[1000px] mx-auto text-center px-6 md:px-10">
		<Reveal
			y={12}
			amount={0.3}
			class="inline-flex items-center gap-2 rounded-full font-mono text-[11px] tracking-[0.18em] uppercase mb-8"
			style="background: rgba(232,80,10,0.08); border: 1px solid rgba(232,80,10,0.3); color: #FF6B2B; padding: 8px 16px;"
		>
			<span class="w-1.5 h-1.5 rounded-full dot-pulse" style="background: #E8500A;"></span>
			{INDIA ? 'One last thing' : 'The last thing'}
		</Reveal>

		<Reveal
			tag="h2"
			y={24}
			amount={0.3}
			duration={0.9}
			class="font-display text-cream"
			style="font-size: clamp(48px, 8vw, 100px); letter-spacing: -0.045em; line-height: 0.93;"
		>
			Your competitors
			<br />
			are already
			<br />
			<span class="text-orange">falling behind.</span>
		</Reveal>

		<p
			class="mt-8 mx-auto text-muted-warm"
			style="max-width: 620px; font-size: 18px; font-weight: 300; line-height: 1.6;"
		>
			{INDIA
				? 'Book a free 20-minute call. We&apos;ll show JHAX working on a real India restaurant — then tell you what it would find in yours.'
				: 'Book a free 20-minute call. We&apos;ll show JHAX working on a real restaurant — then tell you what it would find in yours.'}
		</p>

		<form
			onsubmit={submit}
			novalidate
			data-testid="lead-form"
			class="mt-10 mx-auto flex flex-col sm:flex-row gap-3 max-w-[560px]"
		>
			<div class="relative flex-1">
				<input
					type="email"
					bind:value={email}
					oninput={() => {
						if (status === 'error') {
							status = 'idle';
							message = '';
						}
					}}
					placeholder="your@email.com"
					disabled={status === 'loading'}
					autocomplete="email"
					aria-invalid={status === 'error' ? 'true' : 'false'}
					aria-describedby={status === 'error' ? 'lead-error-msg' : undefined}
					data-testid="lead-email-input"
					class="w-full h-[56px] px-6 rounded-full bg-transparent text-cream placeholder:text-muted-warm outline-none transition-all"
					style="border: 1px solid {borderColor}; background: #0d0d0d; font-size: 15px; font-weight: 500;"
					onfocus={(e) => {
						if (status !== 'error') e.currentTarget.style.borderColor = '#E8500A';
					}}
					onblur={(e) => {
						if (status !== 'error') e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
					}}
				/>
			</div>
			<button
				type="submit"
				disabled={status === 'loading'}
				data-testid="lead-submit-btn"
				class="h-[56px] inline-flex items-center justify-center gap-2 rounded-full px-8 font-semibold whitespace-nowrap"
				style="background: #E8500A; color: #fff; font-size: 15px; opacity: {status === 'loading'
					? 0.65
					: 1}; box-shadow: 0 20px 60px -20px rgba(232,80,10,0.6); transition: transform .2s ease, box-shadow .2s ease, opacity .2s ease;"
				onmouseenter={(e) => {
					if (status === 'loading') return;
					e.currentTarget.style.transform = 'translateY(-2px)';
					e.currentTarget.style.boxShadow = '0 28px 72px -20px rgba(232,80,10,0.8)';
				}}
				onmouseleave={(e) => {
					e.currentTarget.style.transform = 'translateY(0)';
					e.currentTarget.style.boxShadow = '0 20px 60px -20px rgba(232,80,10,0.6)';
				}}
			>
				{#if status === 'loading'}
					<Loader2 size={16} class="animate-spin" /> Booking…
				{:else}
					Book a Demo <span aria-hidden="true">→</span>
				{/if}
			</button>
		</form>

		<!-- Error banner — its own block, never inside the input -->
		{#if status === 'error'}
			<div
				id="lead-error-msg"
				role="alert"
				transition:fade={{ duration: 250 }}
				class="mt-5 mx-auto max-w-[560px] flex items-center justify-center gap-2.5 rounded-2xl px-5 py-3.5 font-mono text-[12px] uppercase tracking-[0.16em]"
				style="background: rgba(220,38,38,0.10); border: 1px solid rgba(220,38,38,0.45); color: #F87171;"
				data-testid="lead-error"
			>
				<AlertCircle size={15} class="flex-shrink-0" />
				<span>{message}</span>
			</div>
		{/if}

		<!-- Success banner — its own block, auto-hides after 5s -->
		{#if status === 'success'}
			<div
				role="status"
				transition:fade={{ duration: 250 }}
				class="mt-5 mx-auto max-w-[560px] flex items-center justify-center gap-2.5 rounded-2xl px-5 py-3.5 font-mono text-[12px] uppercase tracking-[0.16em]"
				style="background: rgba(22,163,74,0.10); border: 1px solid rgba(22,163,74,0.45); color: #22C55E;"
				data-testid="lead-success"
			>
				<CheckCircle2 size={15} class="flex-shrink-0" />
				<span>{message}</span>
			</div>
		{/if}

		<!-- Features / trust strip -->
		<div
			data-testid="lead-features"
			class="mt-8 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 font-mono text-[11px] uppercase tracking-[0.18em] text-muted-warm"
		>
			{#each trust as t (t)}
				<span class="inline-flex items-center gap-2">
					<span style="color: #E8500A;">✓</span>
					{t}
				</span>
			{/each}
		</div>
	</div>
</section>
