import { artistDisplayName, artistSecondaryName } from '@/domain/artists';
import { ARTISTS_CATEGORY_NAME, type ExpenseStatus, type PaymentStatus } from '@/domain/constants';
import { hourlyCost, performanceDurationMinutes, toHHMM } from '@/domain/lineup';
import { AppError, MESSAGES, toAppError } from '@/lib/errors';
import { supabase, type Json } from '@/lib/supabase/client';

// Expenses of one event: rows + payment summary from v_expense_payment_summary (paid,
// remaining, computed status, overdue are SQL-derived) + active coverage. Two queries total.

export interface CoverageVM {
  id: string;
  categoryId: string | null;
  subcategoryId: string | null;
  customLabel: string | null;
}

export interface ExpenseVM {
  id: string;
  eventId: string;
  name: string;
  categoryId: string;
  categoryName: string;
  subcategoryId: string | null;
  subcategoryName: string | null;
  isArtist: boolean;
  vendorId: string | null;
  vendorName: string | null;
  artistId: string | null;
  artistName: string | null;
  artistRealName: string | null;
  plannedAmount: number;
  agreedAmount: number;
  paidAmount: number;
  remainingAmount: number;
  manualStatus: string;
  computedStatus: ExpenseStatus;
  hasOverdue: boolean;
  nextDueDate: string | null;
  paymentsCount: number;
  expenseDate: string | null;
  paidBy: string;
  internalNotes: string;
  startTime: string | null;
  endTime: string | null;
  durationMinutes: number | null;
  hourlyCost: number | null;
  coverage: CoverageVM[];
}

const EXPENSE_SELECT = `id, event_id, name, category_id, subcategory_id, planned_amount, agreed_amount, vendor_id, artist_id,
  paid_by, manual_status, expense_date, internal_notes, performance_start_time, performance_end_time, created_at,
  categories(name), subcategories(name), vendors(name), artists(stage_name, real_name, legacy_name),
  expense_coverage(id, category_id, subcategory_id, custom_label, is_archived)`;

type Row = {
  id: string; event_id: string; name: string; category_id: string; subcategory_id: string | null;
  planned_amount: number; agreed_amount: number; vendor_id: string | null; artist_id: string | null;
  paid_by: string; manual_status: string; expense_date: string | null; internal_notes: string;
  performance_start_time: string | null; performance_end_time: string | null; created_at: string;
  categories: { name: string } | null; subcategories: { name: string } | null; vendors: { name: string } | null;
  artists: { stage_name: string; real_name: string; legacy_name: string | null } | null;
  expense_coverage: { id: string; category_id: string | null; subcategory_id: string | null; custom_label: string | null; is_archived: boolean }[];
};

type SummaryRow = {
  expense_id: string | null; paid_amount: number | null; remaining_amount: number | null; computed_status: string | null;
  has_overdue: boolean | null; next_due_date: string | null; payments_count: number | null;
};

function toVM(r: Row, s: SummaryRow | undefined): ExpenseVM {
  const categoryName = r.categories?.name ?? '';
  const duration = performanceDurationMinutes(r.performance_start_time, r.performance_end_time);
  return {
    id: r.id,
    eventId: r.event_id,
    name: r.name,
    categoryId: r.category_id,
    categoryName,
    subcategoryId: r.subcategory_id,
    subcategoryName: r.subcategories?.name ?? null,
    isArtist: categoryName.trim() === ARTISTS_CATEGORY_NAME,
    vendorId: r.vendor_id,
    vendorName: r.vendors?.name ?? null,
    artistId: r.artist_id,
    artistName: r.artists ? artistDisplayName(r.artists) : null,
    artistRealName: r.artists ? artistSecondaryName(r.artists) : null,
    plannedAmount: r.planned_amount,
    agreedAmount: r.agreed_amount,
    paidAmount: s?.paid_amount ?? 0,
    remainingAmount: s?.remaining_amount ?? r.agreed_amount,
    manualStatus: r.manual_status,
    computedStatus: (s?.computed_status ?? r.manual_status) as ExpenseStatus,
    hasOverdue: !!s?.has_overdue,
    nextDueDate: s?.next_due_date ?? null,
    paymentsCount: s?.payments_count ?? 0,
    expenseDate: r.expense_date,
    paidBy: r.paid_by,
    internalNotes: r.internal_notes,
    startTime: r.performance_start_time ? toHHMM(r.performance_start_time) : null,
    endTime: r.performance_end_time ? toHHMM(r.performance_end_time) : null,
    durationMinutes: duration,
    hourlyCost: hourlyCost(r.agreed_amount, duration),
    coverage: r.expense_coverage
      .filter((c) => !c.is_archived)
      .map((c) => ({ id: c.id, categoryId: c.category_id, subcategoryId: c.subcategory_id, customLabel: c.custom_label })),
  };
}

export async function listEventExpenses(eventId: string): Promise<ExpenseVM[]> {
  const [rows, summaries] = await Promise.all([
    supabase.from('expenses').select(EXPENSE_SELECT).eq('event_id', eventId).eq('is_archived', false).order('created_at'),
    supabase.from('v_expense_payment_summary').select('expense_id, paid_amount, remaining_amount, computed_status, has_overdue, next_due_date, payments_count').eq('event_id', eventId),
  ]);
  if (rows.error) throw toAppError(rows.error, 'listEventExpenses', MESSAGES.load);
  if (summaries.error) throw toAppError(summaries.error, 'listEventExpenses', MESSAGES.load);
  const byId = new Map(summaries.data.map((s) => [s.expense_id, s]));
  return (rows.data as unknown as Row[]).map((r) => toVM(r, byId.get(r.id)));
}

export async function getExpense(id: string): Promise<ExpenseVM> {
  const [row, summary] = await Promise.all([
    supabase.from('expenses').select(EXPENSE_SELECT).eq('id', id).eq('is_archived', false).maybeSingle(),
    supabase.from('v_expense_payment_summary').select('expense_id, paid_amount, remaining_amount, computed_status, has_overdue, next_due_date, payments_count').eq('expense_id', id).maybeSingle(),
  ]);
  if (row.error) throw toAppError(row.error, 'getExpense', MESSAGES.load);
  if (summary.error) throw toAppError(summary.error, 'getExpense', MESSAGES.load);
  if (!row.data) throw new AppError('NOT_FOUND', 'expense', MESSAGES.notFound, 'getExpense');
  return toVM(row.data as unknown as Row, summary.data ?? undefined);
}

export interface ExpenseInput {
  id?: string;
  eventId: string;
  name: string;
  categoryId: string;
  subcategoryId: string | null;
  plannedAmount: number;
  agreedAmount: number;
  vendorId: string | null;
  artistId: string | null;
  paidBy: string;
  manualStatus: string;
  expenseDate: string | null;
  internalNotes: string;
  startTime: string | null;
  endTime: string | null;
  /** null = leave coverage untouched. */
  coverage: { categoryId: string | null; subcategoryId: string | null; customLabel: string | null }[] | null;
  /** null = leave payments untouched (simple mode only applies when there is no split). */
  simplePayment: { isPaid: boolean; dueDate: string | null; paymentMethodId: string | null } | null;
}

/** Expense + coverage + simple payment in one transaction (save_expense RPC, ADR-045). */
export async function saveExpense(input: ExpenseInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_expense', {
    p_expense: {
      id: input.id ?? null,
      event_id: input.eventId,
      name: input.name.trim(),
      category_id: input.categoryId,
      subcategory_id: input.subcategoryId,
      planned_amount: input.plannedAmount,
      agreed_amount: input.agreedAmount,
      vendor_id: input.vendorId,
      artist_id: input.artistId,
      paid_by: input.paidBy,
      manual_status: input.manualStatus,
      expense_date: input.expenseDate,
      internal_notes: input.internalNotes,
      performance_start_time: input.startTime,
      performance_end_time: input.endTime,
    } as Json,
    p_coverage: input.coverage === null ? undefined : (input.coverage.map((c) => ({
      category_id: c.categoryId, subcategory_id: c.subcategoryId, custom_label: c.customLabel,
    })) as Json),
    p_simple_payment: input.simplePayment === null ? undefined : ({
      is_paid: input.simplePayment.isPaid,
      due_date: input.simplePayment.dueDate,
      payment_method_id: input.simplePayment.paymentMethodId,
    } as Json),
  });
  if (error) throw toAppError(error, 'saveExpense');
  return data;
}

export async function archiveExpense(id: string): Promise<void> {
  const { error } = await supabase.rpc('archive_expense', { p_expense_id: id });
  if (error) throw toAppError(error, 'archiveExpense');
}

// ------------------------------------------------------------------------------ payments

export interface PaymentVM {
  id: string;
  expenseId: string;
  amount: number;
  dueDate: string | null;
  paidDate: string | null;
  paymentMethodId: string | null;
  paymentMethodName: string | null;
  status: PaymentStatus;
  note: string;
  isOverdue: boolean;
}

export async function listExpensePayments(expenseId: string): Promise<PaymentVM[]> {
  const { data, error } = await supabase.from('v_payments').select('*').eq('expense_id', expenseId);
  if (error) throw toAppError(error, 'listExpensePayments', MESSAGES.load);
  const rows = data.map((p) => ({
    sortKey: `${p.due_date ?? '9999'}|${p.created_at ?? ''}`,
    vm: {
      id: p.id ?? '',
      expenseId: p.expense_id ?? expenseId,
      amount: p.amount ?? 0,
      dueDate: p.due_date,
      paidDate: p.paid_date,
      paymentMethodId: p.payment_method_id,
      paymentMethodName: p.payment_method_name,
      status: (p.payment_status ?? 'מתוכנן') as PaymentStatus,
      note: p.note ?? '',
      isOverdue: !!p.is_overdue,
    } satisfies PaymentVM,
  }));
  return rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey)).map((r) => r.vm);
}

export interface PaymentInput {
  id?: string;
  expenseId: string;
  amount: number;
  dueDate: string | null;
  paidDate: string | null;
  paymentMethodId: string | null;
  status: PaymentStatus;
  note: string;
}

const toPaymentJson = (p: PaymentInput) => ({
  id: p.id ?? null,
  expense_id: p.expenseId,
  amount: p.amount,
  due_date: p.dueDate,
  paid_date: p.paidDate,
  payment_method_id: p.paymentMethodId,
  payment_status: p.status,
  note: p.note,
});

export async function savePayment(input: PaymentInput): Promise<string> {
  const { data, error } = await supabase.rpc('save_payment', { p: toPaymentJson(input) as Json });
  if (error) throw toAppError(error, 'savePayment');
  return data;
}

/** The whole active set of an expense's payments, saved atomically (split). */
export async function replaceExpensePayments(expenseId: string, payments: PaymentInput[]): Promise<void> {
  const { error } = await supabase.rpc('replace_expense_payments', {
    p_expense_id: expenseId,
    p_payments: payments.map(toPaymentJson) as Json,
  });
  if (error) throw toAppError(error, 'replaceExpensePayments');
}

export async function archivePayment(id: string): Promise<void> {
  const { error } = await supabase.from('payments').update({ is_archived: true }).eq('id', id);
  if (error) throw toAppError(error, 'archivePayment');
}

// ------------------------------------------------------------------------ upcoming list

export interface UpcomingPaymentVM {
  paymentId: string;
  expenseId: string;
  expenseName: string;
  eventId: string;
  eventName: string;
  amount: number;
  dueDate: string;
  status: PaymentStatus;
  isOverdue: boolean;
  daysUntilDue: number;
}

export async function listUpcomingPayments(limit?: number): Promise<UpcomingPaymentVM[]> {
  let q = supabase.from('v_upcoming_payments').select('*').order('due_date');
  if (limit) q = q.limit(limit);
  const { data, error } = await q;
  if (error) throw toAppError(error, 'listUpcomingPayments', MESSAGES.load);
  return data.map((p) => ({
    paymentId: p.payment_id ?? '',
    expenseId: p.expense_id ?? '',
    expenseName: p.expense_name ?? '',
    eventId: p.event_id ?? '',
    eventName: p.event_name ?? '',
    amount: p.amount ?? 0,
    dueDate: p.due_date ?? '',
    status: (p.payment_status ?? 'מתוכנן') as PaymentStatus,
    isOverdue: !!p.is_overdue,
    daysUntilDue: p.days_until_due ?? 0,
  }));
}
