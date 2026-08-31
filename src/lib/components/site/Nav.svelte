<script>
	import { onMount } from 'svelte';
	import { slide } from 'svelte/transition';
	import { Menu, X } from 'lucide-svelte';
	import Logo from './Logo.svelte';

	const links = [
		{ label: 'Product', href: '#product' },
		{ label: 'How it works', href: '#how' },
		{ label: 'Capabilities', href: '#features' },
		{ label: 'FAQ', href: '#faq' }
	];

	let scrolled = $state(false);
	let shown = $state(false);
	let menuOpen = $state(false);

	onMount(() => {
		const onScroll = () => {
			scrolled = window.scrollY > 20;
			if (menuOpen) menuOpen = false; // close the mobile menu when the page scrolls
		};
		onScroll();
		window.addEventListener('scroll', onScroll, { passive: true });
		requestAnimationFrame(() => (shown = true));
		return () => window.removeEventListener('scroll', onScroll);
	});

	const slug = (s) => s.toLowerCase().replace(/\s+/g, '-');
</script>

<header
	data-testid="site-nav"
	class="fixed top-0 left-0 right-0 z-50"
	style="background: {scrolled
		? 'rgba(8,8,8,0.82)'
		: 'rgba(8,8,8,0.45)'}; backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-bottom: {scrolled || menuOpen
		? '1px solid #1E1E1E'
		: '1px solid rgba(30,30,30,0.4)'}; opacity: {shown ? 1 : 0}; transform: translateY({shown
		? 0
		: -60}px); transition: background .3s ease, border-color .3s ease, opacity .7s cubic-bezier(0.22,1,0.36,1) .05s, transform .7s cubic-bezier(0.22,1,0.36,1) .05s;"
>
	<div class="max-w-[1400px] mx-auto flex items-center justify-between px-6 md:px-10 h-[68px]">
		<a href="#top" data-testid="nav-logo" class="flex items-center">
			<Logo size={22} markSize={26} />
		</a>

		<div class="flex items-center gap-3 md:gap-8">
			<nav class="hidden md:flex items-center gap-8">
				{#each links as l (l.href)}
					<a
						href={l.href}
						data-testid="nav-link-{slug(l.label)}"
						class="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-warm hover:text-cream transition-colors"
					>
						{l.label}
					</a>
				{/each}
			</nav>

			<a
				href="https://jhax-coo-446329867486.us-central1.run.app/team"
				rel="noopener"
				data-testid="nav-cta-sign-in"
				class="group relative inline-flex items-center gap-2 pill-btn whitespace-nowrap"
				style="background: #E8500A; color: #fff; padding: 11px 18px; border-radius: 100px; font-size: 13px; font-weight: 600; letter-spacing: -0.01em; transition: transform .2s ease, box-shadow .2s ease; box-shadow: 0 8px 26px -10px rgba(232,80,10,0.6);"
				onmouseenter={(e) => {
					e.currentTarget.style.transform = 'translateY(-2px)';
					e.currentTarget.style.boxShadow = '0 14px 34px -10px rgba(232,80,10,0.75)';
				}}
				onmouseleave={(e) => {
					e.currentTarget.style.transform = 'translateY(0)';
					e.currentTarget.style.boxShadow = '0 8px 26px -10px rgba(232,80,10,0.6)';
				}}
			>
				Sign In / Sign Up <span aria-hidden="true">→</span>
			</a>

			<!-- Hamburger — mobile only -->
			<button
				type="button"
				onclick={() => (menuOpen = !menuOpen)}
				data-testid="nav-mobile-toggle"
				aria-label={menuOpen ? 'Close menu' : 'Open menu'}
				aria-expanded={menuOpen}
				class="md:hidden inline-flex items-center justify-center rounded-full"
				style="width: 40px; height: 40px; background: #0d0d0d; border: 1px solid #1E1E1E; color: #F5F2ED;"
			>
				{#if menuOpen}
					<X size={18} />
				{:else}
					<Menu size={18} />
				{/if}
			</button>
		</div>
	</div>

	<!-- Mobile dropdown menu -->
	{#if menuOpen}
		<nav
			transition:slide={{ duration: 250 }}
			data-testid="nav-mobile-menu"
			class="md:hidden border-t"
			style="border-color: #1E1E1E; background: rgba(8,8,8,0.97); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px);"
		>
			<div class="px-6 py-3 flex flex-col">
				{#each links as l (l.href)}
					<a
						href={l.href}
						onclick={() => (menuOpen = false)}
						data-testid="nav-mobile-link-{slug(l.label)}"
						class="font-mono text-[13px] uppercase tracking-[0.16em] text-muted-warm hover:text-cream transition-colors py-3 border-b"
						style="border-color: #161616;"
					>
						{l.label}
					</a>
				{/each}
				<a
					href="#book-demo"
					onclick={() => (menuOpen = false)}
					data-testid="nav-mobile-cta"
					class="mt-4 mb-2 inline-flex items-center justify-center gap-2 rounded-full font-semibold"
					style="background: #E8500A; color: #fff; padding: 13px 18px; font-size: 14px;"
				>
					Book a demo <span aria-hidden="true">→</span>
				</a>
			</div>
		</nav>
	{/if}
</header>
