// DORON'S RAVE — legacy migration runner (Book 09).
//
//   npm run migrate:legacy              → preflight + transform + load.sql + source metrics
//   npm run migrate:legacy -- reconcile → compare target_extract.json with source metrics
//
// Principles (Book 09 §3): copy first, cut over last; immutable snapshot; new UUIDs with a
// persisted legacy→target map (re-runs reuse it, so no duplicates); parents before children;
// every dropped row lands in rejects.csv with a reason; no silent coercion; no dedupe by name.
// Transforms are deterministic and documented next to the code that performs them.

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadLegacy, type Snapshot } from './legacySandbox';
import { reconcile } from './reconcile';

const HERE = path.dirname(fileURLToPath(import.meta.url)).replace(/[\\/]\.build$/, '');
const SNAP_DIR = path.join(HERE, 'snapshot');
const RUNS_DIR = path.join(HERE, 'runs');
const LEGACY_DIR = path.resolve(HERE, '..', '..', 'src');

type Row = Record<string, unknown> & { __source_row: number };
type Issue = { level: 'reject' | 'warning' | 'info'; entity: string; legacy_id: string; source_row: number | ''; reason: string };

const issues: Issue[] = [];
const report = (level: Issue['level'], entity: string, row: Row | null, reason: string, idCol?: string) =>
  issues.push({ level, entity, legacy_id: row && idCol ? String(row[idCol] ?? '') : '', source_row: row?.__source_row ?? '', reason });

// ------------------------------------------------------------------ normalisers (Book 09 §26–§28)

const isBlank = (v: unknown) => v === '' || v === null || v === undefined;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TS = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;

/** Exactly true/false; blank → field default; anything else is reported, never truthy-coerced. */
function bool(v: unknown, fallback: boolean, ctx: () => void): boolean {
  if (typeof v === 'boolean') return v;
  if (isBlank(v)) return fallback;
  if (typeof v === 'string' && /^(true|false)$/i.test(v.trim())) return v.trim().toLowerCase() === 'true';
  ctx();
  return fallback;
}

/** Money / numbers: formatting stripped only; blank → null (the mapping decides the default). */
function num(v: unknown): number | null | 'invalid' {
  if (isBlank(v)) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 'invalid';
  const s = String(v).replace(/[,\s₪]/g, '');
  if (s === '') return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : 'invalid';
}

function date(v: unknown): string | null | 'invalid' {
  if (isBlank(v)) return null;
  const s = String(v).trim();
  return ISO_DATE.test(s) ? s : 'invalid';
}

function time(v: unknown): string | null | 'invalid' {
  if (isBlank(v)) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(v).trim());
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59) return 'invalid';
  return `${m[1]!.padStart(2, '0')}:${m[2]}`;
}

/** Legacy timestamps are local Israel time 'yyyy-MM-ddTHH:mm:ss' (Utils.gs nowIso_). */
function timestamp(v: unknown): string | null {
  if (isBlank(v)) return null;
  const s = String(v).trim();
  return ISO_TS.test(s) ? s : null;
}

const text = (v: unknown) => (isBlank(v) ? '' : String(v));

// ------------------------------------------------------------------ SQL helpers

const q = (v: unknown): string => {
  if (v === null || v === undefined) return 'null';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') return String(v);
  return `'${String(v).replace(/'/g, "''")}'`;
};
/** Local Israel timestamp → timestamptz; missing/invalid → migration time (reported). */
const tsSql = (v: string | null) => (v ? `(${q(v)}::timestamp at time zone 'Asia/Jerusalem')` : 'now()');

// ------------------------------------------------------------------ id map (Book 09 §9, §32)

type IdMap = Record<string, Record<string, { id: string; row: number }>>;

function loadIdMap(): IdMap {
  const file = path.join(RUNS_DIR, 'id_map.json');
  return fs.existsSync(file) ? (JSON.parse(fs.readFileSync(file, 'utf8')) as IdMap) : {};
}

function main() {
  const mode = process.argv[2] ?? 'prepare';
  const snapshot = JSON.parse(fs.readFileSync(path.join(SNAP_DIR, 'snapshot.json'), 'utf8')) as Snapshot;
  const manifest = JSON.parse(fs.readFileSync(path.join(SNAP_DIR, 'manifest.json'), 'utf8')) as { sha256: string; exported_at: string };
  fs.mkdirSync(RUNS_DIR, { recursive: true });

  if (mode === 'reconcile') {
    reconcile(RUNS_DIR);
    return;
  }

  const runId = `run-${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}`;
  const runDir = path.join(RUNS_DIR, runId);
  fs.mkdirSync(runDir, { recursive: true });

  // Reference date for "today" in legacy formulas (overdue/upcoming) = now, Israel time.
  const now = new Date();
  const legacy = loadLegacy(snapshot, LEGACY_DIR, now);
  const expectedHeaders = legacy.global<Record<string, string[]>>('SHEET_HEADERS');

  // -------------------------------------------------------------- preflight (Book 09 §8)
  const tabs: Record<string, { idCol: string }> = {
    Categories: { idCol: 'category_id' }, Subcategories: { idCol: 'subcategory_id' }, Vendors: { idCol: 'vendor_id' },
    Artists: { idCol: 'artist_id' }, Events: { idCol: 'event_id' }, PaymentMethods: { idCol: 'payment_method_id' },
    Expenses: { idCol: 'expense_id' }, ExpenseCoverage: { idCol: 'coverage_id' }, Payments: { idCol: 'payment_id' },
    Income: { idCol: 'income_id' }, Notes: { idCol: 'note_id' }, Attachments: { idCol: 'attachment_id' },
  };
  const rows = (tab: string) => (snapshot[tab]?.rows ?? []) as Row[];

  for (const [tab, { idCol }] of Object.entries(tabs)) {
    const present = snapshot[tab]?.headers ?? [];
    if (!snapshot[tab]) { report('reject', tab, null, 'tab missing from snapshot'); continue; }
    const missing = (expectedHeaders[tab] ?? []).filter((h) => !present.includes(h));
    const extra = present.filter((h) => !(expectedHeaders[tab] ?? []).includes(h));
    // Columns added by later legacy versions may be absent when the lazy schema upgrade never
    // ran on this sheet; the legacy code treats them as empty, and so do we (reported).
    if (missing.length) report('info', tab, null, `columns not present in the sheet (treated as empty): ${missing.join(', ')}`);
    if (extra.length) report('warning', tab, null, `unexpected columns (ignored): ${extra.join(', ')}`);
    const seen = new Set<string>();
    for (const r of rows(tab)) {
      const id = text(r[idCol]).trim();
      if (!id) report('reject', tab, r, 'empty legacy id', idCol);
      else if (seen.has(id)) report('reject', tab, r, 'duplicate legacy id', idCol);
      seen.add(id);
    }
  }

  // -------------------------------------------------------------- id allocation
  const idMap = loadIdMap();
  const allocate = (entity: string, legacyId: string, sourceRow: number) => {
    idMap[entity] ??= {};
    idMap[entity][legacyId] ??= { id: crypto.randomUUID(), row: sourceRow };
    return idMap[entity][legacyId].id;
  };
  const lookup = (entity: string, legacyId: unknown) => (isBlank(legacyId) ? null : idMap[entity]?.[String(legacyId).trim()]?.id ?? undefined);

  const sql: string[] = [];
  const counts: Record<string, number> = {};
  const insert = (table: string, cols: string[], values: string[]) => {
    sql.push(`insert into public.${table} (${cols.join(', ')}) values (${values.join(', ')});`);
    counts[table] = (counts[table] ?? 0) + 1;
  };
  const loaded = new Set<string>(); // "entity:legacyId" of rows that are actually inserted

  // Parent-before-child order (Book 09 §10). Each block: validate → map → insert.

  // 1. categories
  const categoryName = new Map<string, string>();
  for (const r of rows('Categories')) {
    const lid = text(r.category_id).trim();
    if (!lid || !text(r.name).trim()) { report('reject', 'Categories', r, 'missing id or name', 'category_id'); continue; }
    const id = allocate('categories', lid, r.__source_row);
    categoryName.set(lid, text(r.name).trim());
    insert('categories', ['id', 'name', 'sort_order', 'is_visible', 'is_archived', 'created_at', 'updated_at'], [
      q(id), q(text(r.name)), q(Math.trunc(Number(num(r.sort_order) === 'invalid' ? 0 : num(r.sort_order) ?? 0))),
      q(bool(r.is_visible, true, () => report('warning', 'Categories', r, 'is_visible not boolean → true', 'category_id'))),
      q(bool(r.is_archived, false, () => report('warning', 'Categories', r, 'is_archived not boolean → false', 'category_id'))),
      tsSql(timestamp(r.created_at)), tsSql(timestamp(r.updated_at)),
    ]);
    loaded.add(`categories:${lid}`);
  }

  // 2. subcategories (parent by id only; never by name; artists never get one)
  for (const r of rows('Subcategories')) {
    const lid = text(r.subcategory_id).trim();
    const parent = lookup('categories', r.category_id);
    if (!lid || !parent || !loaded.has(`categories:${text(r.category_id).trim()}`)) { report('reject', 'Subcategories', r, 'orphan: parent category not found', 'subcategory_id'); continue; }
    if (categoryName.get(text(r.category_id).trim()) === 'אמנים') { report('reject', 'Subcategories', r, 'subcategory under the artists category', 'subcategory_id'); continue; }
    const id = allocate('subcategories', lid, r.__source_row);
    insert('subcategories', ['id', 'category_id', 'name', 'sort_order', 'is_visible', 'is_archived', 'created_at', 'updated_at'], [
      q(id), q(parent), q(text(r.name)), q(Math.trunc(Number(num(r.sort_order) === 'invalid' ? 0 : num(r.sort_order) ?? 0))),
      q(bool(r.is_visible, true, () => report('warning', 'Subcategories', r, 'is_visible not boolean → true', 'subcategory_id'))),
      q(bool(r.is_archived, false, () => report('warning', 'Subcategories', r, 'is_archived not boolean → false', 'subcategory_id'))),
      tsSql(timestamp(r.created_at)), tsSql(timestamp(r.updated_at)),
    ]);
    loaded.add(`subcategories:${lid}`);
  }
  const subcategoryParent = new Map(rows('Subcategories').map((r) => [text(r.subcategory_id).trim(), text(r.category_id).trim()]));

  // 3. vendors (no dedupe by name/phone — Book 09 §16)
  for (const r of rows('Vendors')) {
    const lid = text(r.vendor_id).trim();
    if (!text(r.name).trim()) { report('reject', 'Vendors', r, 'vendor without a name', 'vendor_id'); continue; }
    insert('vendors', ['id', 'name', 'phone', 'contact_details', 'notes', 'is_archived', 'created_at', 'updated_at'], [
      q(allocate('vendors', lid, r.__source_row)), q(text(r.name)), q(text(r.phone)), q(text(r.contact_details)), q(text(r.notes)),
      q(bool(r.is_archived, false, () => report('warning', 'Vendors', r, 'is_archived not boolean → false', 'vendor_id'))),
      tsSql(timestamp(r.created_at)), tsSql(timestamp(r.updated_at)),
    ]);
    loaded.add(`vendors:${lid}`);
  }

  // 4. artists: legacy "name" → legacy_name, untouched (Book 09 §17)
  for (const r of rows('Artists')) {
    const lid = text(r.artist_id).trim();
    if (!text(r.name).trim() && !text(r.stage_name).trim() && !text(r.real_name).trim()) { report('reject', 'Artists', r, 'artist without any name', 'artist_id'); continue; }
    insert('artists', ['id', 'legacy_name', 'real_name', 'stage_name', 'phone', 'contact_details', 'notes', 'system_notes', 'is_archived', 'created_at', 'updated_at'], [
      q(allocate('artists', lid, r.__source_row)), q(isBlank(r.name) ? null : text(r.name)), q(text(r.real_name)), q(text(r.stage_name)),
      q(text(r.phone)), q(text(r.contact_details)), q(text(r.notes)), q(text(r.system_notes)),
      q(bool(r.is_archived, false, () => report('warning', 'Artists', r, 'is_archived not boolean → false', 'artist_id'))),
      tsSql(timestamp(r.created_at)), tsSql(timestamp(r.updated_at)),
    ]);
    loaded.add(`artists:${lid}`);
  }

  // 5–7. events, ticket tiers (JSON → rows, order kept), required items (tokens → FKs)
  for (const r of rows('Events')) {
    const lid = text(r.event_id).trim();
    const d = date(r.event_date);
    if (!text(r.name).trim()) { report('reject', 'Events', r, 'event without a name', 'event_id'); continue; }
    if (d === null || d === 'invalid') { report('reject', 'Events', r, `event_date missing or not a date (${text(r.event_date)})`, 'event_id'); continue; }
    const price = num(r.average_ticket_price);
    const count = num(r.expected_ticket_count);
    if (price === 'invalid' || (typeof price === 'number' && price < 0)) { report('reject', 'Events', r, 'average_ticket_price invalid', 'event_id'); continue; }
    if (count === 'invalid' || (typeof count === 'number' && (count < 0 || !Number.isInteger(count)))) { report('reject', 'Events', r, 'expected_ticket_count invalid', 'event_id'); continue; }
    const id = allocate('events', lid, r.__source_row);
    // Legacy stored 0 when the forecast was never entered (toNumber_); the target keeps "not set" as null.
    insert('events', ['id', 'name', 'event_date', 'location', 'general_notes', 'average_ticket_price', 'expected_ticket_count', 'is_archived', 'created_at', 'updated_at'], [
      q(id), q(text(r.name).trim()), q(d), q(text(r.location)), q(text(r.general_notes)),
      q(typeof price === 'number' && price > 0 ? price : null), q(typeof count === 'number' && count > 0 ? count : null),
      q(bool(r.is_archived, false, () => report('warning', 'Events', r, 'is_archived not boolean → false', 'event_id'))),
      tsSql(timestamp(r.created_at)), tsSql(timestamp(r.updated_at)),
    ]);
    loaded.add(`events:${lid}`);
    if (!isBlank(r.skipped_requirements)) report('info', 'Events', r, 'skipped_requirements not migrated (retired mechanism, Book 09 §4)', 'event_id');

    if (!isBlank(r.ticket_tiers)) {
      let tiers: unknown;
      try { tiers = JSON.parse(String(r.ticket_tiers)); } catch { report('reject', 'Events.ticket_tiers', r, 'ticket_tiers is not valid JSON', 'event_id'); tiers = []; }
      (Array.isArray(tiers) ? tiers : []).forEach((t: { name?: unknown; quantity?: unknown; price?: unknown }, i: number) => {
        const qty = num(t?.quantity); const pr = num(t?.price);
        if (typeof qty !== 'number' || qty <= 0 || !Number.isInteger(qty) || typeof pr !== 'number' || pr < 0) {
          report('reject', 'Events.ticket_tiers', r, `tier ${i + 1} invalid`, 'event_id'); return;
        }
        insert('ticket_tiers', ['event_id', 'name', 'quantity', 'price', 'sort_order'], [q(id), q(text(t.name).trim() || `סבב ${i + 1}`), q(qty), q(pr), q(i + 1)]);
      });
    }
    for (const token of String(r.required_items ?? '').split(',').map((s) => s.trim()).filter(Boolean)) {
      const m = /^(cat|sub):(.+)$/.exec(token);
      const target = m ? lookup(m[1] === 'cat' ? 'categories' : 'subcategories', m[2]) : undefined;
      if (!m || !target) { report('reject', 'Events.required_items', r, `token cannot be mapped: ${token}`, 'event_id'); continue; }
      insert('event_required_items', ['event_id', m[1] === 'cat' ? 'category_id' : 'subcategory_id'], [q(id), q(target)]);
    }
  }

  // 8. payment methods (legacy list wins; seed rows are removed first when unreferenced)
  for (const r of rows('PaymentMethods')) {
    const lid = text(r.payment_method_id).trim();
    insert('payment_methods', ['id', 'name', 'sort_order', 'is_active', 'created_at', 'updated_at'], [
      q(allocate('payment_methods', lid, r.__source_row)), q(text(r.name)), q(Math.trunc(Number(num(r.sort_order) === 'invalid' ? 0 : num(r.sort_order) ?? 0))),
      q(bool(r.is_active, true, () => report('warning', 'PaymentMethods', r, 'is_active not boolean → true', 'payment_method_id'))),
      tsSql(timestamp(r.created_at)), tsSql(timestamp(r.updated_at)),
    ]);
    loaded.add(`payment_methods:${lid}`);
  }

  // 9. expenses (Book 09 §18–§19)
  const EXPENSE_STATUSES = ['מתוכנן', 'סוכם'];
  for (const r of rows('Expenses')) {
    const lid = text(r.expense_id).trim();
    const reject = (why: string) => report('reject', 'Expenses', r, why, 'expense_id');
    const eventId = lookup('events', r.event_id);
    const categoryId = lookup('categories', r.category_id);
    if (!eventId || !loaded.has(`events:${text(r.event_id).trim()}`)) { reject('orphan: event not found'); continue; }
    if (!categoryId || !loaded.has(`categories:${text(r.category_id).trim()}`)) { reject('orphan: category not found'); continue; }
    const isArtists = categoryName.get(text(r.category_id).trim()) === 'אמנים';
    let subId: string | null = null;
    if (!isBlank(r.subcategory_id)) {
      if (isArtists) { reject('artist expense with a subcategory'); continue; }
      if (subcategoryParent.get(text(r.subcategory_id).trim()) !== text(r.category_id).trim()) { reject('subcategory does not belong to the expense category'); continue; }
      subId = lookup('subcategories', r.subcategory_id) ?? null;
      if (!subId) { reject('orphan: subcategory not found'); continue; }
    }
    const vendorId = lookup('vendors', r.vendor_id);
    const artistId = lookup('artists', r.artist_id);
    if (vendorId === undefined) { reject('orphan: vendor not found'); continue; }
    if (artistId === undefined) { reject('orphan: artist not found'); continue; }
    const planned = num(r.planned_amount); const agreed = num(r.agreed_amount);
    if (planned === 'invalid' || agreed === 'invalid' || (planned ?? 0) < 0 || (agreed ?? 0) < 0) { reject('amount invalid or negative'); continue; }
    let status = text(r.manual_status).trim();
    if (!EXPENSE_STATUSES.includes(status)) {
      // legacy normalizeManualStatus_ reads anything else as מתוכנן; reported, not silent
      if (status) report('warning', 'Expenses', r, `manual_status "${status}" → מתוכנן (legacy rule)`, 'expense_id');
      status = 'מתוכנן';
    }
    const start = time(r.performance_start_time); const end = time(r.performance_end_time);
    if (start === 'invalid' || end === 'invalid') { reject('performance time not HH:mm'); continue; }
    if ((start === null) !== (end === null)) { reject('only one performance time — needs a data decision (Book 09 §19)'); continue; }
    if (start && start === end) { reject('equal start/end times — needs a data decision (ADR-036)'); continue; }
    if (start && !isArtists) { reject('performance times on a non-artist expense'); continue; }
    const expDate = date(r.expense_date);
    if (expDate === 'invalid') { reject('expense_date not a date'); continue; }
    if (!text(r.name).trim()) { reject('expense without a name'); continue; }
    insert('expenses', ['id', 'event_id', 'name', 'category_id', 'subcategory_id', 'planned_amount', 'agreed_amount', 'vendor_id', 'artist_id', 'paid_by', 'manual_status', 'expense_date', 'internal_notes', 'performance_start_time', 'performance_end_time', 'is_archived', 'created_at', 'updated_at'], [
      q(allocate('expenses', lid, r.__source_row)), q(eventId), q(text(r.name).trim()), q(categoryId), q(subId),
      q(planned ?? 0), q(agreed ?? 0), q(vendorId), q(artistId), q(text(r.paid_by)), q(status), q(expDate),
      q(text(r.internal_notes)), q(start), q(end),
      q(bool(r.is_archived, false, () => report('warning', 'Expenses', r, 'is_archived not boolean → false', 'expense_id'))),
      tsSql(timestamp(r.created_at)), tsSql(timestamp(r.updated_at)),
    ]);
    loaded.add(`expenses:${lid}`);
  }

  // 10. coverage (never money — Book 09 §20)
  for (const r of rows('ExpenseCoverage')) {
    const exp = text(r.expense_id).trim();
    if (!loaded.has(`expenses:${exp}`)) { report('reject', 'ExpenseCoverage', r, 'orphan: expense not loaded', 'coverage_id'); continue; }
    const cat = lookup('categories', r.category_id); const sub = lookup('subcategories', r.subcategory_id);
    if (cat === undefined || sub === undefined) { report('reject', 'ExpenseCoverage', r, 'orphan: category/subcategory not found', 'coverage_id'); continue; }
    if (!cat && !sub && !text(r.custom_label).trim()) { report('reject', 'ExpenseCoverage', r, 'coverage row identifies nothing', 'coverage_id'); continue; }
    if (text(r.custom_label).length > 60) { report('reject', 'ExpenseCoverage', r, 'custom_label longer than 60', 'coverage_id'); continue; }
    insert('expense_coverage', ['id', 'expense_id', 'category_id', 'subcategory_id', 'custom_label', 'is_archived', 'created_at', 'updated_at'], [
      q(allocate('expense_coverage', text(r.coverage_id).trim(), r.__source_row)), q(lookup('expenses', exp)), q(cat), q(sub),
      q(isBlank(r.custom_label) ? null : text(r.custom_label)),
      q(bool(r.is_archived, false, () => report('warning', 'ExpenseCoverage', r, 'is_archived not boolean → false', 'coverage_id'))),
      tsSql(timestamp(r.created_at)), tsSql(timestamp(r.updated_at)),
    ]);
  }

  // 11. payments — a paid payment stays paid (Paid→Planned is a Clone rule only, Book 09 §22)
  const PAYMENT_STATUSES = ['מתוכנן', 'ממתין לתשלום', 'שולם'];
  for (const r of rows('Payments')) {
    const exp = text(r.expense_id).trim();
    const reject = (why: string) => report('reject', 'Payments', r, why, 'payment_id');
    if (!loaded.has(`expenses:${exp}`)) { reject('orphan: expense not loaded'); continue; }
    const amount = num(r.amount);
    if (amount === null || amount === 'invalid' || amount < 0) { reject('amount missing, invalid or negative'); continue; }
    const due = date(r.due_date); const paid = date(r.paid_date);
    if (due === 'invalid' || paid === 'invalid') { reject('due/paid date not a date'); continue; }
    const method = lookup('payment_methods', r.payment_method_id);
    if (method === undefined) { reject('orphan: payment method not found'); continue; }
    let status = text(r.payment_status).trim();
    if (!PAYMENT_STATUSES.includes(status)) {
      report('warning', 'Payments', r, `payment_status "${status}" → מתוכנן (legacy normalizePaymentStatus_)`, 'payment_id');
      status = 'מתוכנן';
    }
    insert('payments', ['id', 'expense_id', 'amount', 'due_date', 'paid_date', 'payment_method_id', 'payment_status', 'note', 'is_archived', 'created_at', 'updated_at'], [
      q(allocate('payments', text(r.payment_id).trim(), r.__source_row)), q(lookup('expenses', exp)), q(amount), q(due), q(paid), q(method),
      q(status), q(text(r.note)),
      q(bool(r.is_archived, false, () => report('warning', 'Payments', r, 'is_archived not boolean → false', 'payment_id'))),
      tsSql(timestamp(r.created_at)), tsSql(timestamp(r.updated_at)),
    ]);
  }

  // 12. income — stored total kept; mismatch with quantity × unit price is reported (§23)
  for (const r of rows('Income')) {
    const reject = (why: string) => report('reject', 'Income', r, why, 'income_id');
    if (!loaded.has(`events:${text(r.event_id).trim()}`)) { reject('orphan: event not loaded'); continue; }
    const qty = num(r.quantity); const unit = num(r.unit_price); const total = num(r.total_amount);
    if ([qty, unit, total].some((v) => v === 'invalid' || (typeof v === 'number' && v < 0))) { reject('number invalid or negative'); continue; }
    const expected = Math.round((Number(qty ?? 0) * Number(unit ?? 0)) * 100) / 100;
    if (total !== null && Math.abs(Number(total) - expected) > 0.005) report('warning', 'Income', r, `total ${total} ≠ quantity×unit ${expected} (kept as stored)`, 'income_id');
    insert('income', ['id', 'event_id', 'name', 'quantity', 'unit_price', 'total_amount', 'notes', 'is_ticket_income', 'is_archived', 'created_at', 'updated_at'], [
      q(allocate('income', text(r.income_id).trim(), r.__source_row)), q(lookup('events', r.event_id)), q(text(r.name).trim() || '—'),
      q(qty ?? 0), q(unit ?? 0), q(total ?? expected), q(text(r.notes)),
      // legacy blank marker = regular income (Book 09 §23)
      q(bool(r.is_ticket_income, false, () => report('warning', 'Income', r, 'is_ticket_income not boolean → false', 'income_id'))),
      q(bool(r.is_archived, false, () => report('warning', 'Income', r, 'is_archived not boolean → false', 'income_id'))),
      tsSql(timestamp(r.created_at)), tsSql(timestamp(r.updated_at)),
    ]);
  }

  // 13. notes — entity map chosen by entity_type, never by content (§24)
  for (const r of rows('Notes')) {
    const type = text(r.entity_type).trim();
    const entity = type === 'event' ? 'events' : type === 'artist' ? 'artists' : null;
    const target = entity ? lookup(entity, r.entity_id) : undefined;
    if (!entity || !target || !loaded.has(`${entity}:${text(r.entity_id).trim()}`)) { report('reject', 'Notes', r, 'orphan: entity not found / unsupported type', 'note_id'); continue; }
    const noteType = text(r.note_type).trim() === 'reminder' ? 'reminder' : 'note';
    const rd = date(r.reminder_date);
    if (rd === 'invalid') { report('reject', 'Notes', r, 'reminder_date not a date', 'note_id'); continue; }
    if (!text(r.content).trim()) { report('reject', 'Notes', r, 'empty note', 'note_id'); continue; }
    insert('notes', ['id', 'entity_type', 'entity_id', 'note_type', 'content', 'reminder_date', 'is_completed', 'is_archived', 'created_at', 'updated_at'], [
      q(allocate('notes', text(r.note_id).trim(), r.__source_row)), q(type), q(target), q(noteType), q(text(r.content)),
      q(noteType === 'reminder' ? rd : null),
      q(noteType === 'reminder' ? bool(r.is_completed, false, () => report('warning', 'Notes', r, 'is_completed not boolean', 'note_id')) : false),
      q(bool(r.is_archived, false, () => report('warning', 'Notes', r, 'is_archived not boolean → false', 'note_id'))),
      tsSql(timestamp(r.created_at)), tsSql(timestamp(r.updated_at)),
    ]);
  }

  // 14. attachments — Drive files are not copied automatically; reported for manual handling (§25)
  for (const r of rows('Attachments')) report('warning', 'Attachments', r, 'attachment binary lives in Google Drive; not migrated automatically', 'attachment_id');

  // timestamps that could not be preserved
  for (const [tab] of Object.entries(tabs)) {
    for (const r of rows(tab)) {
      if (!isBlank(r.created_at) && !timestamp(r.created_at)) report('warning', tab, r, `created_at not a legacy timestamp (${text(r.created_at)}); migration time used`, tabs[tab]!.idCol);
    }
  }

  // -------------------------------------------------------------- write artifacts
  const idMapRows = Object.entries(idMap).flatMap(([entity, m]) => Object.entries(m).map(([lid, v]) => ({ entity, lid, ...v })));
  fs.writeFileSync(path.join(RUNS_DIR, 'id_map.json'), JSON.stringify(idMap, null, 1));
  fs.writeFileSync(path.join(runDir, 'id_map.csv'), ['entity_type,legacy_id,target_id,source_row', ...idMapRows.map((r) => `${r.entity},${r.lid},${r.id},${r.row}`)].join('\n'));
  const csv = (list: Issue[]) => ['level,entity,legacy_id,source_row,reason', ...list.map((i) => [i.level, i.entity, i.legacy_id, i.source_row, `"${i.reason.replace(/"/g, '""')}"`].join(','))].join('\n');
  fs.writeFileSync(path.join(runDir, 'rejects.csv'), csv(issues.filter((i) => i.level === 'reject')));
  fs.writeFileSync(path.join(runDir, 'warnings.csv'), csv(issues.filter((i) => i.level !== 'reject')));

  const guard = `
-- DORON'S RAVE — legacy load ${runId}  (generated; do not edit)
-- snapshot sha256 ${manifest.sha256}
-- One transaction. Aborts unless the business tables are empty (one-shot guard, Book 09 §32).
begin;
do $$
begin
  if exists (select 1 from public.events) or exists (select 1 from public.expenses) or exists (select 1 from public.vendors)
     or exists (select 1 from public.artists) or exists (select 1 from public.subcategories) then
    raise exception 'target is not empty — reset the environment before loading';
  end if;
end $$;
-- Seed dictionaries are replaced by the legacy ones (Book 09 §14, §21): remove unreferenced seed rows.
delete from public.payment_methods pm where not exists (select 1 from public.payments p where p.payment_method_id = pm.id);
delete from public.categories c where not exists (select 1 from public.expenses e where e.category_id = c.id)
  and not exists (select 1 from public.subcategories s where s.category_id = c.id);
`;
  const idMapSql = idMapRows.map((r) =>
    `insert into migration.id_map (entity_type, legacy_id, target_id, run_id, source_row) values (${q(r.entity)}, ${q(r.lid)}, ${q(r.id)}, ${q(runId)}, ${r.row}) on conflict (entity_type, legacy_id) do nothing;`);
  const tail = `
insert into migration.run_log (run_id, snapshot_sha256, status, counts) values (${q(runId)}, ${q(manifest.sha256)}, 'loaded', ${q(JSON.stringify(counts))}::jsonb);
commit;
`;
  // load.sql runs as the database owner in a controlled environment (Book 09 §43), never as the app.
  fs.writeFileSync(path.join(runDir, 'load.sql'), [guard, ...sql, tail].join('\n'));
  // Audit map: idempotent (on conflict do nothing); run right after load.sql succeeded.
  fs.writeFileSync(path.join(runDir, 'load_id_map.sql'), idMapSql.join('\n'));

  // -------------------------------------------------------------- legacy (source) metrics
  const events = rows('Events');
  const finance = legacy.call<{ events: Record<string, unknown>[]; expenses: Record<string, unknown>[]; income: Record<string, unknown>[]; payments: Record<string, unknown>[] }>('loadFinanceData_');
  const perEvent: Record<string, unknown> = {};
  for (const ev of events) {
    const lid = text(ev.event_id).trim();
    const totals = legacy.call<Record<string, number>>('computeEventTotals_', lid, finance.expenses, finance.income, finance.payments);
    const pnl = legacy.call<Record<string, unknown>>('computeEventPnl_', ev, finance.expenses, finance.income);
    const artistsCount = finance.expenses.filter((x) => x.event_id === lid && x.artist_id).length;
    const details = legacy.call<{ success: boolean; data?: { artistLineup?: { start_time: string; end_time: string; duration_minutes: number; overlaps_with: string[]; expense_id: string }[]; readiness?: unknown } }>('getEventDetails', lid);
    const plannedTotal = finance.expenses.filter((x) => x.event_id === lid)
      .reduce((s, x) => s + (Number(x.planned_amount) > 0 ? Number(x.planned_amount) : Number(x.agreed_amount || 0)), 0);
    perEvent[lid] = {
      target_id: lookup('events', lid),
      totals, pnl, artists_count: artistsCount, planned_total: plannedTotal,
      lineup: (details.data?.artistLineup ?? []).map((s) => ({ expense: lookup('expenses', s.expense_id), start: s.start_time, end: s.end_time, minutes: s.duration_minutes, overlaps: s.overlaps_with.length })),
      readiness: legacy.call('summarizeEventReadiness_', ev, finance.expenses,
        legacy.call('buildNameMaps_', finance), legacy.call('coverageMapByExpense_', legacy.call('buildNameMaps_', finance).categories, legacy.call('buildNameMaps_', finance).subcategories),
        legacy.call('paidExpenseIdSet_', finance.payments)),
    };
  }
  const tabCounts = Object.fromEntries(Object.keys(tabs).map((t) => [t, {
    total: rows(t).length,
    archived: rows(t).filter((r) => bool(r.is_archived, false, () => undefined)).length,
  }]));
  const upcoming = legacy.call<{ payment_id: string; is_overdue: boolean; event_id: string }[]>('buildUpcomingPayments_', finance, legacy.call('todayIso_'));
  const source = {
    run_id: runId,
    reference_today: legacy.call('todayIso_'),
    snapshot_sha256: manifest.sha256,
    tab_counts: tabCounts,
    statuses: {
      payments: count(rows('Payments').map((r) => text(r.payment_status))),
      expenses: count(rows('Expenses').map((r) => text(r.manual_status))),
      income_ticket: count(rows('Income').map((r) => String(bool(r.is_ticket_income, false, () => undefined)))),
    },
    sums: {
      planned: sum(rows('Expenses').map((r) => r.planned_amount)),
      agreed: sum(rows('Expenses').map((r) => r.agreed_amount)),
      paid: sum(rows('Payments').filter((r) => text(r.payment_status) === 'שולם').map((r) => r.amount)),
      income: sum(rows('Income').map((r) => r.total_amount)),
    },
    upcoming: upcoming.map((p) => {
      const ev = events.find((e) => text(e.event_id).trim() === p.event_id);
      return { payment: lookup('payments', p.payment_id), overdue: p.is_overdue, event: lookup('events', p.event_id),
        event_is_upcoming: text(ev?.event_date) >= legacy.call<string>('todayIso_') };
    }),
    per_event: perEvent,
  };
  fs.writeFileSync(path.join(RUNS_DIR, 'source_metrics.json'), JSON.stringify(source, null, 1));

  const byLevel = count(issues.map((i) => i.level));
  const summary = { run_id: runId, snapshot: manifest.sha256, inserted: counts, issues: byLevel };
  fs.writeFileSync(path.join(runDir, 'preflight_report.json'), JSON.stringify({ ...summary, issues_detail: issues }, null, 1));
  console.log(JSON.stringify(summary, null, 1));
  console.log(`artifacts: ${path.relative(process.cwd(), runDir)}`);
  if ((byLevel.reject ?? 0) > 0) process.exitCode = 2;
}

function count(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((m, v) => ({ ...m, [v]: (m[v] ?? 0) + 1 }), {});
}
function sum(values: unknown[]): number {
  return Math.round(values.reduce<number>((s, v) => s + (typeof v === 'number' ? v : Number(v) || 0), 0) * 100) / 100;
}

main();
