import { getQuotes } from '#lib/api/quotes.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const quotes = await getQuotes();
	return { quotes };
};
