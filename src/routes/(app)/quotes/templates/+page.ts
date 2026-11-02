import { getTemplates } from '#lib/api/templates.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	return { templates: await getTemplates() };
};
