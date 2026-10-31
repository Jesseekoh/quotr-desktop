import { getTemplates } from '#lib/api/templates.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	const templates = await getTemplates();
	const requested = url.searchParams.get('template');
	return {
		templates,
		templateId: templates.some((template) => template.id === requested) ? requested : null
	};
};
