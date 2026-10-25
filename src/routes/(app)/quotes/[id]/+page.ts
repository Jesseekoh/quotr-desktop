import { error } from '@sveltejs/kit';
import { getQuote } from '#lib/api/quotes.js';
import { AppError } from '#lib/api/types.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	try {
		return { quote: await getQuote(params.id) };
	} catch (cause) {
		if (cause instanceof AppError) error(cause.status, cause.message);
		throw cause;
	}
};
