import { getDashboardStats, getRecentQuotes } from '#lib/api/dashboard.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const [stats, quotes] = await Promise.all([getDashboardStats('90d'), getRecentQuotes('all')]);
	return { stats, quotes };
};
