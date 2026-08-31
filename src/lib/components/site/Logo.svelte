<script>
	// JHAX wordmark: "JHA" cream + "X" orange + ".ai" orange @55%. Locked per brand.
	import JhaxMark from './JhaxMark.svelte';
	let { size = 22, markSize = 28, showDotAi = true } = $props();
</script>

<div class="inline-flex items-center gap-2" data-testid="jhax-logo">
	<JhaxMark size={markSize} />
	<span
		style="font-family: Bricolage Grotesque, sans-serif; font-weight: 800; font-size: {size}px; letter-spacing: -0.03em; line-height: 1;"
	><span style="color: #F5F2ED;">JHA</span><span style="color: #E8500A;">X</span>{#if showDotAi}<span
				style="color: #E8500A; font-weight: 500; font-size: {Math.round(
					size * 0.55
				)}px; margin-left: 2px;">.ai</span
			>{/if}</span
	>
</div>
