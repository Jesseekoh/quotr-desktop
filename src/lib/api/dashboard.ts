import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db, selectRows } from '#lib/db/index.js';
import * as table from '#lib/db/schema.js';
import { quoteTotals } from '#lib/utils/quote-totals.js';
import { QUOTE_EXPIRY_DAYS } from '#lib/utils/quotes.js';

const RANGE_DAYS = { '7d': 7, '30d': 30, '90d': 90 } as const;
export type DashboardRange = keyof typeof RANGE_DAYS;
export type RecentQuoteStatus = 'all' | 'DRAFT' | 'SENT' | 'ACCEPTED';

function startOfUtcDay(date: Date): Date {
	return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * Per-quote min/max totals with the same rule as quoteTotals():
 * ungrouped items + per section (base items + min/max across its options' totals).
 * Sections without options contribute just their base.
 */
const PER_QUOTE_TOTALS = `
	WITH per_section AS (
		SELECT s.id AS sid, s.quote_id,
			COALESCE(b.base, 0) AS base,
			om.opt_min, om.opt_max
		FROM quote_section s
		LEFT JOIN (
			SELECT quote_section_id AS sid, SUM(total_price) AS base
			FROM quote_item WHERE quote_option_id IS NULL GROUP BY quote_section_id
		) b ON b.sid = s.id
		LEFT JOIN (
			SELECT o.quote_section_id AS sid,
				MIN(t.total) AS opt_min, MAX(t.total) AS opt_max
			FROM quote_option o
			JOIN (SELECT quote_option_id AS oid, SUM(total_price) AS total
			      FROM quote_item GROUP BY quote_option_id) t ON t.oid = o.id
			GROUP BY o.quote_section_id
		) om ON om.sid = s.id
	),
	per_quote AS (
		SELECT qq.id,
			COALESCE(u.ungrouped, 0)
				+ COALESCE(SUM(COALESCE(ps.base, 0) + COALESCE(ps.opt_min, 0)), 0) AS overall_min,
			COALESCE(u.ungrouped, 0)
				+ COALESCE(SUM(COALESCE(ps.base, 0) + COALESCE(ps.opt_max, 0)), 0) AS overall_max
		FROM quote qq
		LEFT JOIN per_section ps ON ps.quote_id = qq.id
		LEFT JOIN (
			SELECT quote_id, SUM(total_price) AS ungrouped FROM quote_item
			WHERE quote_section_id IS NULL AND quote_option_id IS NULL GROUP BY quote_id
		) u ON u.quote_id = qq.id
		GROUP BY qq.id, u.ungrouped
	)
`;

type CardRow = Record<
	| 'value_current'
	| 'value_previous'
	| 'sent_current'
	| 'sent_previous'
	| 'accepted_current'
	| 'accepted_previous'
	| 'awaiting_count'
	| 'awaiting_value',
	number | null
>;

export type DashboardStats = Awaited<ReturnType<typeof getDashboardStats>>;

/** Stat cards + per-day chart series for the selected range. */
export async function getDashboardStats(range: DashboardRange) {
	const days = RANGE_DAYS[range];
	const now = new Date();
	const currentStart = startOfUtcDay(new Date(now.getTime() - (days - 1) * 86_400_000));
	const currentStartMs = currentStart.getTime();
	const previousStartMs = currentStartMs - days * 86_400_000;
	const expiryCutoffMs = now.getTime() - QUOTE_EXPIRY_DAYS * 86_400_000;

	const [cardRows, chartRows] = await Promise.all([
		selectRows<CardRow>(
			`${PER_QUOTE_TOTALS}
			SELECT
				COALESCE(SUM(CASE WHEN qq.sent_at >= $1 THEN pq.overall_max ELSE 0 END), 0) AS value_current,
				COALESCE(SUM(CASE WHEN qq.sent_at >= $2 AND qq.sent_at < $1 THEN pq.overall_max ELSE 0 END), 0) AS value_previous,
				SUM(CASE WHEN qq.sent_at >= $1 THEN 1 ELSE 0 END) AS sent_current,
				SUM(CASE WHEN qq.sent_at >= $2 AND qq.sent_at < $1 THEN 1 ELSE 0 END) AS sent_previous,
				SUM(CASE WHEN qq.accepted_at >= $1 THEN 1 ELSE 0 END) AS accepted_current,
				SUM(CASE WHEN qq.accepted_at >= $2 AND qq.accepted_at < $1 THEN 1 ELSE 0 END) AS accepted_previous,
				SUM(CASE WHEN qq.status = 'SENT' AND (qq.sent_at IS NULL OR qq.sent_at >= $3) THEN 1 ELSE 0 END) AS awaiting_count,
				COALESCE(SUM(CASE WHEN qq.status = 'SENT' AND (qq.sent_at IS NULL OR qq.sent_at >= $3) THEN pq.overall_max ELSE 0 END), 0) AS awaiting_value
			FROM quote qq
			JOIN per_quote pq ON pq.id = qq.id`,
			[currentStartMs, previousStartMs, expiryCutoffMs]
		),
		selectRows<{ day: string; cnt: number; kind: 'created' | 'accepted' }>(
			`SELECT DATE(created_at / 1000, 'unixepoch') AS day, COUNT(*) AS cnt, 'created' AS kind
			FROM quote WHERE created_at >= $1 GROUP BY day
			UNION ALL
			SELECT DATE(accepted_at / 1000, 'unixepoch') AS day, COUNT(*) AS cnt, 'accepted' AS kind
			FROM quote WHERE accepted_at IS NOT NULL AND accepted_at >= $1 GROUP BY day`,
			[currentStartMs]
		)
	]);

	const cards = cardRows[0] ?? ({} as Partial<CardRow>);
	const num = (value: number | null | undefined) => Number(value ?? 0);

	// Zero-fill every day of the range so the area chart has no gaps.
	const countsByDay = new Map<string, { created: number; accepted: number }>();
	for (const row of chartRows) {
		const entry = countsByDay.get(row.day) ?? { created: 0, accepted: 0 };
		entry[row.kind] = Number(row.cnt);
		countsByDay.set(row.day, entry);
	}
	const chart: { date: string; created: number; accepted: number }[] = [];
	for (let i = 0; i < days; i++) {
		const key = new Date(currentStartMs + i * 86_400_000).toISOString().slice(0, 10);
		chart.push({ date: key, ...(countsByDay.get(key) ?? { created: 0, accepted: 0 }) });
	}

	return {
		range,
		cards: {
			value: { current: num(cards.value_current), previous: num(cards.value_previous) },
			sent: { current: num(cards.sent_current), previous: num(cards.sent_previous) },
			acceptance: {
				current: num(cards.accepted_current),
				previous: num(cards.accepted_previous),
				sentCurrent: num(cards.sent_current),
				sentPrevious: num(cards.sent_previous)
			},
			awaiting: { count: num(cards.awaiting_count), value: num(cards.awaiting_value) }
		},
		chart
	};
}

export type RecentQuotes = Awaited<ReturnType<typeof getRecentQuotes>>;

/** Recent quotes for the tabbed table: per-status counts + latest rows with totals. */
export async function getRecentQuotes(status: RecentQuoteStatus) {
	const statusCounts = await db
		.select({ status: table.quote.status, count: sql<number>`count(*)` })
		.from(table.quote)
		.groupBy(table.quote.status);
	const countByStatus = Object.fromEntries(statusCounts.map((r) => [r.status, Number(r.count)]));
	const counts = {
		all: statusCounts.reduce((total, r) => total + Number(r.count), 0),
		DRAFT: countByStatus.DRAFT ?? 0,
		SENT: countByStatus.SENT ?? 0,
		ACCEPTED: countByStatus.ACCEPTED ?? 0
	};

	const rows = await db
		.select({
			id: table.quote.id,
			quoteNumber: table.quote.quoteNumber,
			status: table.quote.status,
			createdAt: table.quote.createdAt,
			sentAt: table.quote.sentAt,
			acceptedAt: table.quote.acceptedAt,
			customerName: table.customer.name
		})
		.from(table.quote)
		.innerJoin(table.customer, eq(table.customer.id, table.quote.customerId))
		.where(and(status === 'all' ? undefined : eq(table.quote.status, status)))
		.orderBy(desc(table.quote.createdAt))
		.limit(20);

	// Totals per quote through the shared quoteTotals() rule — bounded to the
	// selected rows, so gathering their items/sections here stays cheap.
	const ids = rows.map((row) => row.id);
	const totalsById = new Map<string, { overallMin: number; overallMax: number }>();
	if (ids.length) {
		const [items, sections, options] = await Promise.all([
			db.select().from(table.quoteItem).where(inArray(table.quoteItem.quoteId, ids)),
			db.select().from(table.quoteSection).where(inArray(table.quoteSection.quoteId, ids)),
			db.select().from(table.quoteOption).where(inArray(table.quoteOption.quoteId, ids))
		]);
		for (const row of rows) {
			const quoteItems = items.filter((i) => i.quoteId === row.id);
			const quoteSections = sections
				.filter((s) => s.quoteId === row.id)
				.map((s) => ({
					...s,
					items: quoteItems.filter((i) => i.quoteSectionId === s.id && i.quoteOptionId === null),
					options: options
						.filter((o) => o.quoteSectionId === s.id)
						.map((o) => ({ ...o, items: quoteItems.filter((i) => i.quoteOptionId === o.id) }))
				}));
			const totals = quoteTotals({ items: quoteItems, sections: quoteSections });
			totalsById.set(row.id, { overallMin: totals.overallMin, overallMax: totals.overallMax });
		}
	}

	return {
		counts,
		rows: rows.map((row) => ({
			...row,
			totalMin: totalsById.get(row.id)?.overallMin ?? 0,
			totalMax: totalsById.get(row.id)?.overallMax ?? 0
		}))
	};
}
