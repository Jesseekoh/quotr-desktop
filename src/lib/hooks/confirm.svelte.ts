// A promise-based replacement for window.confirm(), which doesn't block (or
// show at all) in every desktop WebView. <ConfirmDialog /> in the root layout
// renders whatever request is pending.

export interface ConfirmOptions {
	title: string;
	description?: string;
	confirmLabel?: string;
	destructive?: boolean;
}

interface PendingConfirm extends ConfirmOptions {
	resolve: (confirmed: boolean) => void;
}

class ConfirmState {
	pending = $state<PendingConfirm | null>(null);

	ask(options: ConfirmOptions): Promise<boolean> {
		// A new request replaces (and declines) any still-open one.
		this.pending?.resolve(false);
		return new Promise((resolve) => {
			this.pending = { ...options, resolve };
		});
	}

	settle(confirmed: boolean) {
		this.pending?.resolve(confirmed);
		this.pending = null;
	}
}

export const confirmState = new ConfirmState();

export function confirm(options: ConfirmOptions) {
	return confirmState.ask(options);
}
