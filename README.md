# Quotr Desktop

Offline desktop version of Quotr: import a solar price list, build multi-option quotes, turn them
into invoices, and export branded PDFs. Built with Tauri 2, SvelteKit (SPA mode), shadcn-svelte and
Drizzle ORM over libsql.

## Developing

```sh
bun install
bun tauri dev      # desktop window with hot reload
bun run check      # svelte-check
bun run test       # unit + data-layer integration tests
bun tauri build    # installers for the current OS
```

## How it fits together

- **No server, no auth.** Pages load data in `+page.ts` / `+layout.ts` by calling plain async
  functions in `src/lib/api/*`, which query SQLite through Drizzle's `sqlite-proxy` and
  `tauri-plugin-libsql`. Mutations call the same functions, then `invalidate`/`invalidateAll`.
- **First run.** `(app)/+layout.ts` redirects to `/onboarding` until the business details are saved
  (name, contact details, logo, and an optional Excel product import).
- **Data.** The database lives in the OS app-data folder as `quotr.db`
  (e.g. `~/.local/share/com.jesseekoh.quotr-desktop/` on Linux). Settings → Data opens it.
- **Migrations.** Edit `src/lib/db/schema.ts`, run `bun run db:generate`, and the new SQL in
  `drizzle/` is bundled and applied on the next launch (`src/hooks.client.ts`).
- **PDFs** are generated with pdfmake and written through the native save dialog.

## Keyboard shortcuts

| Shortcut     | Action                                   |
| ------------ | ---------------------------------------- |
| Ctrl/⌘ K     | Search quotes, invoices, products        |
| Ctrl/⌘ N     | New quote                                |
| Ctrl/⌘ ,     | Settings                                 |
| Ctrl/⌘ B     | Toggle sidebar                           |
| Ctrl/⌘ E     | Export PDF (quote or invoice page)       |
| Ctrl/⌘ I     | Add item (quote builder)                 |
| Ctrl/⌘ S     | Save (settings)                          |
| ↑ / ↓, Enter | Move through the quotes list, open quote |
