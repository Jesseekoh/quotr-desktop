import { db } from '#lib/db/index.js';
import * as table from '#lib/db/schema.js';
import type { BrandSettings } from './types.js';
import { AppError } from './types.js';

// Logos are downscaled before saving; this cap is just a backstop.
const MAX_LOGO_LENGTH = 1_000_000;
const LOGO_PATTERN = /^data:image\/(png|jpeg);base64,/;

export async function getBrandSettings(): Promise<BrandSettings> {
	const settings = await db.query.brandSettings.findFirst();
	return {
		businessName: settings?.businessName ?? null,
		logo: settings?.logo ?? null,
		email: settings?.email ?? null,
		phone: settings?.phone ?? null,
		address: settings?.address ?? null,
		onboardedAt: settings?.onboardedAt ?? null
	};
}

export type BrandSettingsInput = Partial<Omit<BrandSettings, 'onboardedAt'>>;

function clean(value: string | null | undefined) {
	if (value === undefined) return undefined;
	return value?.trim() || null;
}

export async function updateBrandSettings(input: BrandSettingsInput) {
	if (input.logo && (input.logo.length > MAX_LOGO_LENGTH || !LOGO_PATTERN.test(input.logo))) {
		throw new AppError(400, 'The logo must be a PNG or JPEG under 1 MB.');
	}
	const values = {
		businessName: clean(input.businessName),
		email: clean(input.email),
		phone: clean(input.phone),
		address: clean(input.address),
		logo: input.logo
	};
	await db
		.insert(table.brandSettings)
		.values({ id: 1, ...values })
		.onConflictDoUpdate({ target: table.brandSettings.id, set: values });
}

/** Mark first-run setup as done so the app shell stops redirecting to onboarding. */
export async function completeOnboarding(input: BrandSettingsInput) {
	await updateBrandSettings(input);
	await db.update(table.brandSettings).set({ onboardedAt: new Date() });
}
