/**
 * Brand spelling folded for matching: case, spaces and punctuation are
 * ignored, so "SMK/Proton", "Smk/Proton" and "Icell Power"/"IcellPower" match.
 */
export function brandKey(brand: string): string {
	return brand.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function specKey(spec: string): string {
	return spec.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Identity of a catalog product, shared by the workbook parser and the import.
 * Panels repeat brand + spec across wattages, so capacity is part of it.
 */
export function productKey(brand: string, specification: string, capacity?: unknown): string {
	const cap =
		capacity === null || capacity === undefined || capacity === '' ? '' : String(capacity);
	return `${brandKey(brand)}\u0000${specKey(specification)}\u0000${cap}`;
}

/** Capacity as recorded in a product's technical specs, if any. */
export function capacityOf(technicalSpecs: unknown): unknown {
	if (technicalSpecs && typeof technicalSpecs === 'object' && 'capacity' in technicalSpecs) {
		return (technicalSpecs as { capacity?: unknown }).capacity;
	}
	return undefined;
}
