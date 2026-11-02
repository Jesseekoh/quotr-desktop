import { error } from '@sveltejs/kit';
import { getInvoice } from '#lib/api/invoices.js';
import { AppError } from '#lib/api/types.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params }) => {
	try {
		return { invoice: await getInvoice(params.id) };
	} catch (cause) {
		if (cause instanceof AppError) error(cause.status, cause.message);
		throw cause;
	}
};
