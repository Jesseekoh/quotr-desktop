import { getProducts } from '#lib/api/products.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	const category = url.searchParams.get('category') ?? undefined;
	const search = url.searchParams.get('search') ?? '';
	const products = await getProducts({ search, category });
	return { products, category, search, openImport: url.searchParams.has('import') };
};
