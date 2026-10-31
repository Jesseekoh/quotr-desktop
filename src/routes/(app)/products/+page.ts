import { getCategories, getProducts } from '#lib/api/products.js';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ url }) => {
	const category = url.searchParams.get('category') ?? undefined;
	const search = url.searchParams.get('search') ?? '';
	const [products, categories] = await Promise.all([
		getProducts({ search, category }),
		getCategories()
	]);
	return { products, categories, category, search, openImport: url.searchParams.has('import') };
};
