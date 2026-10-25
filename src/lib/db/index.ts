import { drizzle } from 'drizzle-orm/sqlite-proxy';
import { createDrizzleProxy, Database, migrate } from 'tauri-plugin-libsql-api';
import * as schema from './schema';

// Relative to the app-data folder configured in src-tauri/src/lib.rs.
const DB_PATH = 'sqlite:quotr.db';

// Vite inlines the SQL text at build time, so the WebView needs no filesystem access.
const migrations = import.meta.glob<string>('/drizzle/*.sql', {
	eager: true,
	query: '?raw',
	import: 'default'
});

let connection: Database | undefined;
let ready: Promise<Database> | undefined;

/** Open the database and apply pending migrations. Safe to call repeatedly. */
export function initDatabase(): Promise<Database> {
	ready ??= (async () => {
		const database = await Database.load(DB_PATH);
		await migrate(DB_PATH, migrations);
		// SQLite leaves foreign keys off per connection; the schema relies on cascades.
		await database.execute('PRAGMA foreign_keys = ON');
		connection = database;
		return database;
	})().catch((cause) => {
		ready = undefined;
		throw cause;
	});
	return ready;
}

/**
 * Raw SQL that returns rows as objects keyed by column name. Drizzle's proxy
 * hands back positional arrays, which is awkward for hand-written aggregates.
 */
export async function selectRows<T>(query: string, values: unknown[] = []): Promise<T[]> {
	const database = connection ?? (await initDatabase());
	return database.select<T[]>(query, values);
}

const proxy = createDrizzleProxy(DB_PATH);

// For `get`, drizzle's sqlite-proxy expects the bare row (or nothing), but the
// plugin returns `[row]`. Unwrapped as-is, an empty result reads as a row of
// undefined columns, so findFirst() would never return undefined.
const callback: typeof proxy = async (sql, params, method) => {
	const result = await proxy(sql, params, method);
	return method === 'get' ? { rows: result.rows[0] as unknown[] } : result;
};

export const db = drizzle(callback, { schema });
