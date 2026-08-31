<script>
	import Nav from '@/components/site/Nav.svelte';
	import Hero from '@/components/site/Hero.svelte';
	import FreeAudit from '@/components/site/FreeAudit.svelte';
	import TrustStrip from '@/components/site/TrustStrip.svelte';
	import ProblemSection from '@/components/site/ProblemSection.svelte';
	import RealRestaurantProof from '@/components/site/RealRestaurantProof.svelte';
	import ProductDemo from '@/components/site/ProductDemo.svelte';
	import HowItWorks from '@/components/site/HowItWorks.svelte';
	import Features from '@/components/site/Features.svelte';
	import TheLoop from '@/components/site/TheLoop.svelte';
	import Marquee from '@/components/site/Marquee.svelte';
	import FAQ from '@/components/site/FAQ.svelte';
	import Stats from '@/components/site/Stats.svelte';
	import FinalCTA from '@/components/site/FinalCTA.svelte';
	import Footer from '@/components/site/Footer.svelte';
</script>

<svelte:head>
	<title>JHAX.ai India | Your Restaurant. On Autopilot.</title>
	<meta
		name="description"
		content="JHAX.ai for India restaurant operators. Same JHAX flow, localized for INR, India-first examples, and local operating reality."
	/>
</svelte:head>

<div data-testid="landing-page-india" class="relative">
	<Nav />
	<main>
		<Hero />
		<FreeAudit />
		<TrustStrip />
		<ProblemSection />
		<RealRestaurantProof />
		<ProductDemo />
		<HowItWorks />
		<Features />
		<TheLoop />
		<Marquee />
		<FAQ />
		<Stats />
		<FinalCTA />
	</main>
	<Footer />
</div>
