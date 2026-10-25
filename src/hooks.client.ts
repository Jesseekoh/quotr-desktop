import type { ClientInit, HandleClientError } from '@sveltejs/kit';
import { initDatabase } from '#lib/db/index.js';
import { AppError } from '#lib/api/types.js';

// Runs once before the first navigation, so every load can assume the schema is current.
export const init: ClientInit = async () => {
	await initDatabase();
};

export const handleError: HandleClientError = ({ error, message }) => {
	console.error(error);
	return { message: error instanceof AppError ? error.message : message };
};
