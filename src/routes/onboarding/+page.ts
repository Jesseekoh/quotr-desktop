import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getBrandSettings } from '#lib/api/settings.js';
import { countProducts } from '#lib/api/products.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [brand, productCount] = await Promise.all([getBrandSettings(), countProducts()]);
	if (brand.onboardedAt) redirect(307, resolve('/dashboard'));
	return { brand, productCount };
};
