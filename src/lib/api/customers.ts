import { asc, like, or } from 'drizzle-orm';
import { db } from '#lib/db/index.js';
import * as table from '#lib/db/schema.js';

export interface CreateCustomerPayload {
	name: string;
	phone?: string;
	email?: string;
	address?: string;
}

export async function createCustomer(data: CreateCustomerPayload) {
	const [customer] = await db.insert(table.customer).values(data).returning();
	return customer;
}

export async function searchCustomers(search: string) {
	const term = `%${search}%`;
	return db
		.select()
		.from(table.customer)
		.where(
			or(
				like(table.customer.name, term),
				like(table.customer.email, term),
				like(table.customer.phone, term),
				like(table.customer.address, term)
			)
		)
		.orderBy(asc(table.customer.name))
		.limit(20);
}
