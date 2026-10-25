import { redirect } from '@sveltejs/kit';
import { resolve } from '$app/paths';
import { getBrandSettings } from '#lib/api/settings.js';
import type { LayoutLoad } from './$types';

export const load: LayoutLoad = async ({ depends }) => {
	depends('app:brand');
	const brand = await getBrandSettings();
	if (!brand.onboardedAt) redirect(307, resolve('/onboarding'));
	return { brand };
};
