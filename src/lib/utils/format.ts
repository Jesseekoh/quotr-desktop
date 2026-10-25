export function formatNaira(value: string | number | null | undefined): string {
	if (value === null || value === undefined || value === '') return '—';
	const num = typeof value === 'string' ? Number(value) : value;
	if (Number.isNaN(num)) return '—';
	return new Intl.NumberFormat('en-NG', {
		style: 'currency',
		currency: 'NGN',
		maximumFractionDigits: 2
	}).format(num);
}

export function categoryLabel(category: string | null | undefined): string {
	if (!category) return '—';
	return category
		.toLowerCase()
		.split('_')
		.map((w) => w[0].toUpperCase() + w.slice(1))
		.join(' ');
}
