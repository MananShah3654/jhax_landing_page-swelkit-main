import { browser } from '$app/environment';

export function isIndiaRoute() {
	return browser && window.location.pathname.startsWith('/india');
}

export function formatLocaleNumber(value, digits = 0) {
	return new Intl.NumberFormat(isIndiaRoute() ? 'en-IN' : 'en-US', {
		minimumFractionDigits: digits,
		maximumFractionDigits: digits
	}).format(value);
}

export function formatMoney(value, digits = 0) {
	return `${isIndiaRoute() ? '₹' : '$'}${formatLocaleNumber(value, digits)}`;
}
