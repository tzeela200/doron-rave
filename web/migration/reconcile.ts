// Reconciliation (Book 09 §33–§36, Book 10 §38–§41). Source numbers come from the legacy code
// (source_metrics.json); target numbers are recomputed from the Supabase extract with the
// app's own domain functions — the exact code the screens use. Money tolerance: 0.01.

import fs from 'node:fs';
import path from 'node:path';
import { buildLineup } from '@/domain/lineup';
import { computeEventPnl } from '@/domain/pnl';
import { buildReadiness } from '@/domain/readiness';

const TOLERANCE = 0.01;
type Check = { area: string; item: string; source: unknown; target: unknown; pass: boolean; note?: string };

const money = (a: unknown, b: unknown) =>
  (a === null || a === undefined) === (b === null || b === undefined) && (a == null || Math.abs(Number(a) - Number(b)) <= TOLERANCE);
const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON artifacts from two systems
type Json = any;

export function reconcile(runsDir: string) {
  const source: Json = JSON.parse(fs.readFileSync(path.join(runsDir, 'source_metrics.json'), 'utf8'));
  const raw = JSON.parse(fs.readFileSync(path.join(runsDir, 'target_extract.json'), 'utf8'));
  const target: Json = raw.extract ?? raw;
  const checks: Check[] = [];
  const add = (area: string, item: string, s: unknown, t: unknown, pass: boolean, note?: string) => checks.push({ area, item, source: s, target: t, pass, note });

  // counts (active/archived separately)
  for (const [tab, s] of Object.entries<Json>(source.tab_counts)) {
    const t = target.counts[tab] ?? { total: 0, archived: 0 };
    add('counts', `${tab} total`, s.total, t.total, s.total === t.total);
    add('counts', `${tab} archived`, s.archived, t.archived, s.archived === t.archived);
  }
  // statuses
  for (const k of ['payments', 'expenses', 'income_ticket']) {
    const s = source.statuses[k] ?? {}; const t = target.statuses[k] ?? {};
    for (const key of new Set([...Object.keys(s), ...Object.keys(t)])) add('statuses', `${k}:${key}`, s[key] ?? 0, t[key] ?? 0, (s[key] ?? 0) === (t[key] ?? 0));
  }
  // global money
  for (const k of ['planned', 'agreed', 'paid', 'income']) add('money', k, source.sums[k], target.sums[k], money(source.sums[k], target.sums[k]));
  // integrity
  for (const [k, v] of Object.entries(target.orphans)) add('integrity', k, 0, v, v === 0);

  // per event
  for (const [legacyId, s] of Object.entries<Json>(source.per_event)) {
    const id = s.target_id; const t = target.events?.[id];
    const label = `event ${legacyId.slice(0, 8)}`;
    if (!t) { add('events', `${label} present`, true, false, false); continue; }
    const tot = t.totals;
    add(label, 'agreed expenses', s.totals.total_expenses, tot.agreed_expenses, money(s.totals.total_expenses, tot.agreed_expenses));
    add(label, 'income', s.totals.total_income, tot.income_total, money(s.totals.total_income, tot.income_total));
    add(label, 'balance', s.totals.balance, tot.balance, money(s.totals.balance, tot.balance));
    add(label, 'paid', s.totals.total_paid, tot.paid_total, money(s.totals.total_paid, tot.paid_total));
    add(label, 'remaining to pay', s.totals.total_remaining, tot.remaining_to_pay, money(s.totals.total_remaining, tot.remaining_to_pay));
    add(label, 'artists count', s.artists_count, tot.artists_count, s.artists_count === tot.artists_count);

    const pnl = computeEventPnl({
      plannedExpenses: Number(tot.planned_expenses), ticketsSold: Number(tot.tickets_sold), ticketIncome: Number(tot.ticket_income),
      nonTicketIncome: Number(tot.non_ticket_income), averageTicketPrice: t.average_ticket_price, expectedTicketCount: t.expected_ticket_count, tiers: t.tiers,
    });
    const sp = s.pnl;
    add(label, 'planned expenses', sp.planned_expenses, pnl.plannedExpenses, money(sp.planned_expenses, pnl.plannedExpenses));
    add(label, 'tickets sold', sp.tickets_sold, pnl.ticketsSold, money(sp.tickets_sold, pnl.ticketsSold));
    add(label, 'ticket income', sp.ticket_income, pnl.ticketIncome, money(sp.ticket_income, pnl.ticketIncome));
    add(label, 'non-ticket income', sp.non_ticket_income, pnl.nonTicketIncome, money(sp.non_ticket_income, pnl.nonTicketIncome));
    add(label, 'remaining cost to cover', sp.remaining_cost_to_cover, pnl.remainingCostToCover, money(sp.remaining_cost_to_cover, pnl.remainingCostToCover));
    add(label, 'break-even tickets', sp.break_even_tickets, pnl.breakEvenTickets, same(sp.break_even_tickets, pnl.breakEvenTickets));
    add(label, 'break-even remaining', sp.break_even_remaining, pnl.breakEvenRemaining, same(sp.break_even_remaining, pnl.breakEvenRemaining));
    add(label, 'break-even unreachable', sp.break_even_unreachable, pnl.breakEvenUnreachable, same(sp.break_even_unreachable, pnl.breakEvenUnreachable));
    add(label, 'expected profit', sp.forecast_profit, pnl.forecastProfit, money(sp.forecast_profit, pnl.forecastProfit));

    const r = buildReadiness(t.required, t.expenses.map((e: Json) => ({ ...e, agreedAmount: Number(e.agreedAmount), paidAmount: Number(e.paidAmount) })), t.coverage,
      { categoryName: () => '', subcategoryName: () => '', subcategoryParentName: () => '' });
    add(label, 'readiness defined', s.readiness.configured, r.defined, s.readiness.configured === r.defined);
    if (r.defined) {
      add(label, 'readiness closed/total', `${s.readiness.done}/${s.readiness.total}`, `${r.closed}/${r.total}`, s.readiness.done === r.closed && s.readiness.total === r.total);
      // The legacy percentage is expense coverage; ours is now hand-marked progress, so the
    // comparable number here is coveragePercent (Book 04 §9 + user decision 2026-09-23).
    add(label, 'readiness coverage percent', s.readiness.percent, r.coveragePercent, s.readiness.percent === r.coveragePercent);
    }

    const lineup = buildLineup(t.expenses.map((e: Json) => ({ expenseId: e.id, artistId: e.artistId, displayName: e.name, realName: null, start: e.start, end: e.end, agreedAmount: Number(e.agreedAmount) })));
    add(label, 'line-up order & duration', s.lineup.map((x: Json) => `${x.expense}|${x.minutes}`), lineup.map((x) => `${x.expenseId}|${x.durationMinutes}`),
      same(s.lineup.map((x: Json) => `${x.expense}|${x.minutes}`), lineup.map((x) => `${x.expenseId}|${x.durationMinutes}`)));
    add(label, 'line-up overlap warnings', s.lineup.map((x: Json) => x.overlaps), lineup.map((x) => x.overlapsWith.length), same(s.lineup.map((x: Json) => x.overlaps), lineup.map((x) => x.overlapsWith.length)));
  }

  // upcoming payments: legacy includes past, non-archived events; Book 04 §13 limits to active
  // (upcoming) events. A difference caused only by that rule is reported, not failed.
  const tset = new Set(target.upcoming.map((p: Json) => p.payment));
  for (const p of source.upcoming) {
    const inTarget = tset.has(p.payment);
    const t = target.upcoming.find((x: Json) => x.payment === p.payment);
    add('upcoming', `payment ${String(p.payment).slice(0, 8)}`, { overdue: p.overdue }, t ? { overdue: t.overdue } : 'not listed',
      inTarget ? p.overdue === t.overdue : !p.event_is_upcoming,
      inTarget ? undefined : p.event_is_upcoming ? 'missing from target' : 'expected: event is in the past — Book 04 §13 lists active events only');
  }
  for (const t of target.upcoming) {
    if (!source.upcoming.some((p: Json) => p.payment === t.payment)) add('upcoming', `payment ${String(t.payment).slice(0, 8)}`, 'not listed', t, false);
  }

  const failed = checks.filter((c) => !c.pass);
  const report = { snapshot: source.snapshot_sha256, reference_today: source.reference_today, total: checks.length, failed: failed.length, checks };
  fs.writeFileSync(path.join(runsDir, 'reconciliation_report.json'), JSON.stringify(report, null, 1));
  const md = [
    `# Reconciliation — ${failed.length === 0 ? 'PASS' : 'FAIL'}`,
    `snapshot ${source.snapshot_sha256} · today ${source.reference_today} · ${checks.length} checks · ${failed.length} failed`,
    '', '| area | item | source | target | result |', '|---|---|---|---|---|',
    ...checks.map((c) => `| ${c.area} | ${c.item} | ${JSON.stringify(c.source)} | ${JSON.stringify(c.target)} | ${c.pass ? 'PASS' : 'FAIL'}${c.note ? ` — ${c.note}` : ''} |`),
  ].join('\n');
  fs.writeFileSync(path.join(runsDir, 'reconciliation_report.md'), md);
  console.log(`reconciliation: ${checks.length} checks, ${failed.length} failed`);
  for (const f of failed) console.log('FAIL', f.area, f.item, JSON.stringify(f.source), '→', JSON.stringify(f.target));
  if (failed.length) process.exitCode = 3;
}
