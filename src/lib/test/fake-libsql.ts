import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

// Stands in for the Rust side of tauri-plugin-libsql in unit tests, so the
// plugin's real JS (drizzle proxy, migration runner, Database class) runs
// against an in-memory SQLite database.

let database = new DatabaseSync(':memory:');

export function resetFakeDatabase() {
	database.close();
	database = new DatabaseSync(':memory:');
}

// The plugin binds `$1`-style placeholders positionally, like `?1`.
function toNumbered(query: string) {
	return query.replace(/\$(\d+)/g, '?$1');
}

function bind(values: unknown[] = []): SQLInputValue[] {
	return values.map((value) => {
		if (typeof value === 'boolean') return value ? 1 : 0;
		return value as SQLInputValue;
	});
}

type Args = { db?: string; query?: string; values?: unknown[]; queries?: string[] };

export async function fakeInvoke(command: string, args: Args = {}): Promise<unknown> {
	switch (command) {
		case 'plugin:libsql|load':
			return args.db ?? '';
		case 'plugin:libsql|execute': {
			const result = database.prepare(toNumbered(args.query!)).run(...bind(args.values));
			return { rowsAffected: Number(result.changes), lastInsertId: Number(result.lastInsertRowid) };
		}
		case 'plugin:libsql|select':
			return database
				.prepare(toNumbered(args.query!))
				.all(...bind(args.values))
				.map((row) => ({ ...row }));
		case 'plugin:libsql|batch':
			database.exec('BEGIN');
			try {
				for (const query of args.queries ?? []) database.exec(query);
				database.exec('COMMIT');
			} catch (cause) {
				database.exec('ROLLBACK');
				throw cause;
			}
			return null;
		default:
			throw new Error(`fakeInvoke: unhandled command ${command}`);
	}
}
