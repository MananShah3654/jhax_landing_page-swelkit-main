<script>
	// JHAX star mark — 4-point concave star in orange with a lighter orange dot.
	// SVG path is locked per brand rules; do not edit.
	let { size = 28, class: className = '' } = $props();
</script>

<svg
	width={size}
	height={size}
	viewBox="0 0 64 64"
	class={className}
	fill="none"
	xmlns="http://www.w3.org/2000/svg"
	aria-hidden="true"
>
	<path
		d="M32 2 C34.5 21.5 42.5 29.5 62 32 C42.5 34.5 34.5 42.5 32 62 C29.5 42.5 21.5 34.5 2 32 C21.5 29.5 29.5 21.5 32 2 Z"
		fill="#E8500A"
	/>
	<circle cx="28.5" cy="32" r="3.2" fill="#FF6B2B" />
</svg>
