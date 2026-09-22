import { computeEventPnl, type Pnl, type TicketTier } from '@/domain/pnl';
import { AppError, MESSAGES, toAppError } from '@/lib/errors';
import { supabase, type Json } from '@/lib/supabase/client';
import type { Database } from '@/lib/supabase/database.types';

// Events data access. Lists read v_event_overview (one row per event, sums already exact in
// SQL) plus the tiers of the listed events in ONE query — never a query per card.

type OverviewRow = Omit<Database['public']['Views']['v_event_overview']['Row'], 'created_at' | 'updated_at'>;

export type EventsFilter = 'active' | 'upcoming' | 'past' | 'archive';

export interface EventSummaryVM {
  id: string;
  name: string;
  eventDate: string;
  /** HH:MM or null (addendum 2026-09-22). End earlier than start = crosses midnight. */
  startTime: string | null;
  endTime: string | null;
  location: string;
  generalNotes: string;
  isArchived: boolean;
  isUpcoming: boolean;
  daysUntil: number;
  averageTicketPrice: number | null;
  expectedTicketCount: number | null;
  agreedExpenses: number;
  plannedExpenses: number;
  paidTotal: number;
  remainingToPay: number;
  incomeTotal: number;
  ticketIncome: number;
  nonTicketIncome: number;
  ticketsSold: number;
  balance: number;
  expensesCount: number;
  artistsCount: number;
  tiers: TicketTier[];
  pnl: Pnl;
}

const OVERVIEW_COLUMNS =
  'id, name, event_date, location, general_notes, is_archived, is_upcoming, days_until, average_ticket_price, expected_ticket_count, agreed_expenses, planned_expenses, paid_total, remaining_to_pay, income_total, ticket_income, non_ticket_income, tickets_sold, balance, expenses_count, artists_count, event_start_time, event_end_time';

function toSummary(r: OverviewRow, tiers: TicketTier[]): EventSummaryVM {
  if (!r.id || !r.name || !r.event_date) throw new AppError('DB', 'overview_shape', MESSAGES.load, 'toSummary');
  // Sums below are COALESCEd in SQL, so a 0 here is a real zero, not a missing value.
  const base = {
    id: r.id,
    name: r.name,
    eventDate: r.event_date,
    startTime: r.event_start_time ? r.event_start_time.slice(0, 5) : null,
    endTime: r.event_end_time ? r.event_end_time.slice(0, 5) : null,
    location: r.location ?? '',
    generalNotes: r.general_notes ?? '',
    isArchived: !!r.is_archived,
    isUpcoming: !!r.is_upcoming,
    daysUntil: r.days_until ?? 0,
    averageTicketPrice: r.average_ticket_price,
    expectedTicketCount: r.expected_ticket_count,
    agreedExpenses: r.agreed_expenses ?? 0,
    plannedExpenses: r.planned_expenses ?? 0,
    paidTotal: r.paid_total ?? 0,
    remainingToPay: r.remaining_to_pay ?? 0,
    incomeTotal: r.income_total ?? 0,
    ticketIncome: r.ticket_income ?? 0,
    nonTicketIncome: r.non_ticket_income ?? 0,
    ticketsSold: r.tickets_sold ?? 0,
    balance: r.balance ?? 0,
    expensesCount: r.expenses_count ?? 0,
    artistsCount: r.artists_count ?? 0,
    tiers,
  };
  return {
    ...base,
    pnl: computeEventPnl({
      plannedExpenses: base.plannedExpenses,
      ticketsSold: base.ticketsSold,
      ticketIncome: base.ticketIncome,
      nonTicketIncome: base.nonTicketIncome,
      averageTicketPrice: base.averageTicketPrice,
      expectedTicketCount: base.expectedTicketCount,
      tiers,
    }),
  };
}

async function tiersByEvent(eventIds: string[]): Promise<Map<string, TicketTier[]>> {
  const map = new Map<string, TicketTier[]>();
  if (eventIds.length === 0) return map;
  const { data, error } = await supabase
    .from('ticket_tiers')
    .select('event_id, name, quantity, price, sort_order')
    .in('event_id', eventIds)
    .order('sort_order');
  if (error) throw toAppError(error, 'tiersByEvent', MESSAGES.load);
  for (const t of data) map.set(t.event_id, [...(map.get(t.event_id) ?? []), { name: t.name, quantity: t.quantity, price: t.price }]);
  return map;
}

/** Upcoming first (nearest first), then history (latest first) — legacy getEvents order. */
export function sortEvents(list: EventSummaryVM[]): EventSummaryVM[] {
  return [...list].sort((a, b) => {
    if (a.isUpcoming !== b.isUpcoming) return a.isUpcoming ? -1 : 1;
    const cmp = a.eventDate.localeCompare(b.eventDate);
    return a.isUpcoming ? cmp : -cmp;
  });
}

export async function listEvents(filter: EventsFilter): Promise<EventSummaryVM[]> {
  let q = supabase.from('v_event_overview').select(OVERVIEW_COLUMNS);
  if (filter === 'archive') q = q.eq('is_archived', true);
  else q = q.eq('is_archived', false);
  if (filter === 'upcoming') q = q.eq('is_upcoming', true);
  if (filter === 'past') q = q.eq('is_upcoming', false);
  const { data, error } = await q;
  if (error) throw toAppError(error, 'listEvents', MESSAGES.load);
  const tiers = await tiersByEvent(data.flatMap((r) => (r.id ? [r.id] : [])));
  return sortEvents(data.map((r) => toSummary(r, tiers.get(r.id ?? '') ?? [])));
}

export async function listEventsByIds(ids: readonly string[]): Promise<EventSummaryVM[]> {
  if (ids.length === 0) return [];
  const { data, error } = await supabase.from('v_event_overview').select(OVERVIEW_COLUMNS).in('id', [...ids]);
  if (error) throw toAppError(error, 'listEventsByIds', MESSAGES.load);
  const tiers = await tiersByEvent([...ids]);
  return data.map((r) => toSummary(r, tiers.get(r.id ?? '') ?? []));
}

export async function getEventSummary(id: string): Promise<EventSummaryVM> {
  const [row, tiers] = await Promise.all([
    supabase.from('v_event_overview').select(OVERVIEW_COLUMNS).eq('id', id).maybeSingle(),
    tiersByEvent([id]),
  ]);
  if (row.error) throw toAppError(row.error, 'getEventSummary', MESSAGES.load);
  if (!row.data) throw new AppError('NOT_FOUND', 'event', MESSAGES.notFound, 'getEventSummary');
  return toSummary(row.data, tiers.get(id) ?? []);
}

export interface EventInput {
  id?: string;
  name: string;
  eventDate: string;
  startTime: string | null;
  endTime: string | null;
  location: string;
  generalNotes: string;
  averageTicketPrice: number | null;
  expectedTicketCount: number | null;
  /** undefined = leave tiers as they are; [] = remove all tiers. */
  tiers?: TicketTier[];
}

/** Event + forecast + tiers in one transaction (save_event RPC). */
export async function saveEvent(input: EventInput): Promise<string> {
  const payload = {
    id: input.id ?? null,
    name: input.name.trim(),
    event_date: input.eventDate,
    event_start_time: input.startTime,
    event_end_time: input.endTime,
    location: input.location.trim(),
    general_notes: input.generalNotes,
    average_ticket_price: input.averageTicketPrice,
    expected_ticket_count: input.expectedTicketCount,
  };
  const tiers = input.tiers === undefined ? undefined : (input.tiers.map((t) => ({ name: t.name, quantity: t.quantity, price: t.price })) as Json);
  const { data, error } = await supabase.rpc('save_event', { p: payload as Json, p_tiers: tiers });
  if (error) throw toAppError(error, 'saveEvent');
  return data;
}

export async function archiveEvent(id: string): Promise<void> {
  const { error } = await supabase.from('events').update({ is_archived: true }).eq('id', id);
  if (error) throw toAppError(error, 'archiveEvent');
}

export interface CloneInput {
  sourceEventId: string;
  mode: 'structure' | 'all';
  name: string;
  eventDate: string;
  location: string;
  generalNotes: string;
  averageTicketPrice: number | null;
  expectedTicketCount: number | null;
  expenseIds: string[];
}

/** One transaction on the server; never a loop of client inserts (Book 08 §28). */
export async function cloneEvent(input: CloneInput): Promise<string> {
  const { data, error } = await supabase.rpc('clone_event', {
    p: {
      source_event_id: input.sourceEventId,
      mode: input.mode,
      name: input.name.trim(),
      event_date: input.eventDate,
      location: input.location,
      general_notes: input.generalNotes,
      average_ticket_price: input.averageTicketPrice,
      expected_ticket_count: input.expectedTicketCount,
      expense_ids: input.expenseIds,
    } as Json,
  });
  if (error) throw toAppError(error, 'cloneEvent');
  return data;
}
