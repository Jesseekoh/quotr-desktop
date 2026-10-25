// Keyboard shortcuts. `mod` is Ctrl, or Cmd on macOS, so bindings read the
// same in code on every platform.

export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

/** Display form of a binding, e.g. "mod+k" → "Ctrl K" or "⌘ K". */
export function shortcutLabel(binding: string): string {
	return binding
		.split('+')
		.map((part) => {
			if (part === 'mod') return isMac ? '⌘' : 'Ctrl';
			if (part === 'shift') return isMac ? '⇧' : 'Shift';
			return part.length === 1 ? part.toUpperCase() : part;
		})
		.join(' ');
}

export function matchesShortcut(event: KeyboardEvent, binding: string): boolean {
	const parts = binding.toLowerCase().split('+');
	const key = parts.at(-1);
	const wantsMod = parts.includes('mod');
	const wantsShift = parts.includes('shift');
	const mod = isMac ? event.metaKey : event.ctrlKey;
	return (
		mod === wantsMod &&
		event.shiftKey === wantsShift &&
		!event.altKey &&
		event.key.toLowerCase() === key
	);
}

/**
 * Keydown handler for a set of bindings: `<svelte:window onkeydown={shortcuts({ 'mod+e': exportPdf })} />`.
 * Handlers run even from inside inputs, since every binding uses a modifier.
 */
export function shortcuts(bindings: Record<string, (event: KeyboardEvent) => void>) {
	return (event: KeyboardEvent) => {
		if (event.defaultPrevented || event.repeat) return;
		for (const [binding, handler] of Object.entries(bindings)) {
			if (matchesShortcut(event, binding)) {
				event.preventDefault();
				handler(event);
				return;
			}
		}
	};
}
