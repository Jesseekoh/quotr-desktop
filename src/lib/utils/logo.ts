// Logos are redrawn as PNG so SVG/WebP uploads still embed in the PDF, and
// capped in size so the data URL stays small enough to store in the DB.
const MAX_WIDTH = 600;
const MAX_HEIGHT = 240;

export const LOGO_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'svg'];
export const LOGO_ACCEPT = 'image/png,image/jpeg,image/webp,image/svg+xml';

export async function toPngDataUrl(file: File): Promise<string> {
	const url = URL.createObjectURL(file);
	try {
		const image = new Image();
		image.src = url;
		await image.decode();
		// SVGs without explicit dimensions report 0x0.
		const width = image.naturalWidth || MAX_WIDTH;
		const height = image.naturalHeight || MAX_HEIGHT;
		const scale = Math.min(1, MAX_WIDTH / width, MAX_HEIGHT / height);
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(width * scale);
		canvas.height = Math.round(height * scale);
		canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height);
		return canvas.toDataURL('image/png');
	} finally {
		URL.revokeObjectURL(url);
	}
}
