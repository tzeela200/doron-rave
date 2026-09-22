import { MESSAGES, toAppError } from '@/lib/errors';
import { supabase } from '@/lib/supabase/client';

// Expense breakdowns come straight from v_event_expense_breakdown (Book 04 §12): every
// active expense counted once, sums reconciling with the event total. Labels for the null
// buckets are the canonical UI words, not stored rows.

export const NO_SUBCATEGORY_LABEL = 'ללא תת־קטגוריה';
export const NO_VENDOR_LABEL = 'ללא ספק';

export interface BreakdownLine {
  keyId: string | null;
  label: string;
  amount: number;
  count: number;
}

export interface CategoryBreakdown extends BreakdownLine {
  subcategories: BreakdownLine[];
}

export interface EventBreakdownVM {
  byCategory: CategoryBreakdown[];
  byVendor: BreakdownLine[];
}

export async function getEventBreakdown(eventId: string): Promise<EventBreakdownVM> {
  const { data, error } = await supabase.from('v_event_expense_breakdown').select('*').eq('event_id', eventId);
  if (error) throw toAppError(error, 'getEventBreakdown', MESSAGES.load);

  const line = (r: (typeof data)[number], empty: string): BreakdownLine => ({
    keyId: r.key_id,
    label: r.key_id ? r.label ?? '' : empty,
    amount: r.amount ?? 0,
    count: r.expense_count ?? 0,
  });

  const subs = data.filter((r) => r.dimension === 'subcategory');
  const byCategory = data
    .filter((r) => r.dimension === 'category')
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
    .map((c) => ({
      ...line(c, ''),
      subcategories: subs
        .filter((s) => s.parent_id === c.key_id)
        .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
        .map((s) => line(s, NO_SUBCATEGORY_LABEL)),
    }));
  const byVendor = data
    .filter((r) => r.dimension === 'vendor')
    .sort((a, b) => (b.amount ?? 0) - (a.amount ?? 0))
    .map((v) => line(v, NO_VENDOR_LABEL));
  return { byCategory, byVendor };
}

/** Per-category agreed totals for several events (comparison screen, Book 05 §17). */
export async function getCategoryTotalsForEvents(eventIds: readonly string[]): Promise<Map<string, Map<string, { label: string; amount: number }>>> {
  const result = new Map<string, Map<string, { label: string; amount: number }>>();
  if (eventIds.length === 0) return result;
  const { data, error } = await supabase
    .from('v_event_expense_breakdown')
    .select('event_id, key_id, label, amount')
    .eq('dimension', 'category')
    .in('event_id', [...eventIds]);
  if (error) throw toAppError(error, 'getCategoryTotalsForEvents', MESSAGES.load);
  for (const r of data) {
    if (!r.event_id || !r.key_id) continue;
    const m = result.get(r.event_id) ?? new Map();
    m.set(r.key_id, { label: r.label ?? '', amount: r.amount ?? 0 });
    result.set(r.event_id, m);
  }
  return result;
}
