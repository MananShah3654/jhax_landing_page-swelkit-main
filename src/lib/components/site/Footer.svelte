<script>
	import Logo from './Logo.svelte';
	import { isIndiaRoute } from '@/siteVariant.js';
</script>

<footer data-testid="site-footer" class="relative border-t" style="border-color: #1E1E1E;">
	<div
		class="max-w-[1400px] mx-auto px-6 md:px-10 py-10 flex flex-col md:flex-row items-start md:items-center gap-6"
	>
		<div class="flex items-center gap-3">
			<Logo size={22} markSize={26} />
		</div>
		<div class="text-muted-warm text-[14px] md:mx-auto text-center max-w-md">
			{isIndiaRoute()
				? 'Your restaurant has a new operating brain. And it never sleeps.'
				: 'Your restaurant has a new boss. And it never sleeps.'}
		</div>
		<div class="font-mono text-[11px] uppercase tracking-[0.18em] text-ghost">
			© 2026 JHAX.ai — All rights reserved
		</div>
	</div>
</footer>
