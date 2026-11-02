import { getInvoices } from '#lib/api/invoices.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	const invoices = await getInvoices();
	return { invoices };
};
