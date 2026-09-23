import { EXPENSE_MANUAL_STATUS, READINESS_COMPLETION, type ReadinessCompletion } from './constants';

// Production readiness (Book 04 §9, §10; CALCULATIONS.md §5; legacy buildOperationalCoverage_).
// The list is the user's own `event_required_items`. Nothing here is money.
//
// Two independent facts per item (user decision 2026-09-23):
//   completion — what the producer marked by hand: לא התחיל / בטיפול / בוצע. THIS drives the
//                percentage, because most of the work has no expense behind it.
//   state      — derived from expenses and coverage exactly as before (covered / included /
//                in_progress / missing). Shown next to the item; never changes money and no
//                longer changes the percentage.
//
// Matching is by id key, never by name:
//   an expense contributes to  sub:<subcategory_id>  when it has a subcategory, else cat:<category_id>
//   a coverage row contributes to sub:<id> / cat:<id> / label:<text> the same way
// So a required *category* is closed by an expense filed directly on that category, exactly as
// in the legacy system.

export type ReadinessState = 'covered' | 'included' | 'in_progress' | 'missing';

const RANK: Record<Exclude<ReadinessState, 'missing'>, number> = { covered: 0, included: 1, in_progress: 2 };

export interface ReadinessExpense {
  id: string;
  name: string;
  categoryId: string;
  subcategoryId: string | null;
  agreedAmount: number;
  manualStatus: string;
  paidAmount: number;
}

export interface ReadinessCoverage {
  expenseId: string;
  expenseName: string;
  categoryId: string | null;
  subcategoryId: string | null;
  customLabel: string | null;
}

export interface RequiredItem {
  id: string;
  categoryId: string | null;
  subcategoryId: string | null;
  /** Older rows have no status; they read as "not started" (backwards compatible). */
  completion?: ReadinessCompletion;
  /** Free text: who is responsible. '' = nobody assigned. */
  owner?: string;
}

export interface ReadinessItemVM {
  itemId: string;
  key: string;
  label: string;
  parentLabel: string | null;
  state: ReadinessState;
  /** Name of the expense that includes this item ("כלול ב־X"), when state = included. */
  includedByLabel: string | null;
  linkedExpenseId: string | null;
  completion: ReadinessCompletion;
  owner: string;
}

export interface ReadinessVM {
  /** false = the user has not chosen a list → no percentage at all, not 0% (ADR-033). */
  defined: boolean;
  items: ReadinessItemVM[];
  /** Marked בוצע by hand — the numerator of `percent`. */
  completed: number;
  inProgress: number;
  /** Derived from money: items covered by an expense or included in one (unchanged meaning). */
  closed: number;
  missing: number;
  total: number;
  /** completed / total (ADR-033: null when the user has not chosen a list). */
  percent: number | null;
  /** closed / total — the expense coverage, kept for reports and migration reconciliation. */
  coveragePercent: number | null;
}

export interface ReadinessLabels {
  categoryName: (id: string) => string | undefined;
  subcategoryName: (id: string) => string | undefined;
  subcategoryParentName: (id: string) => string | undefined;
}

export function readinessKey(categoryId: string | null, subcategoryId: string | null, customLabel?: string | null): string {
  if (subcategoryId) return `sub:${subcategoryId}`;
  if (categoryId) return `cat:${categoryId}`;
  const label = (customLabel ?? '').trim();
  return label ? `label:${label}` : '';
}

interface Hit {
  state: Exclude<ReadinessState, 'missing'>;
  expenseId: string;
  expenseName: string;
}

/** An expense is closed when agreed > 0 and (manual status סוכם or something was paid). */
export function isExpenseClosed(e: Pick<ReadinessExpense, 'agreedAmount' | 'manualStatus' | 'paidAmount'>): boolean {
  return e.agreedAmount > 0 && (e.manualStatus === EXPENSE_MANUAL_STATUS.AGREED || e.paidAmount > 0);
}

export function buildReadiness(
  required: readonly RequiredItem[],
  expenses: readonly ReadinessExpense[],
  coverage: readonly ReadinessCoverage[],
  labels: ReadinessLabels,
): ReadinessVM {
  const byKey = new Map<string, Hit>();
  const put = (key: string, hit: Hit) => {
    if (!key) return;
    const prev = byKey.get(key);
    if (prev && RANK[prev.state] <= RANK[hit.state]) return;
    byKey.set(key, hit);
  };

  for (const e of expenses) {
    put(readinessKey(e.categoryId, e.subcategoryId), {
      state: isExpenseClosed(e) ? 'covered' : 'in_progress',
      expenseId: e.id,
      expenseName: e.name,
    });
  }
  for (const c of coverage) {
    put(readinessKey(c.categoryId, c.subcategoryId, c.customLabel), {
      state: 'included',
      expenseId: c.expenseId,
      expenseName: c.expenseName,
    });
  }

  const items: ReadinessItemVM[] = required.map((r) => {
    const key = readinessKey(r.categoryId, r.subcategoryId);
    const hit = byKey.get(key);
    const label = r.subcategoryId
      ? labels.subcategoryName(r.subcategoryId) ?? ''
      : r.categoryId
        ? labels.categoryName(r.categoryId) ?? ''
        : '';
    return {
      itemId: r.id,
      key,
      label,
      parentLabel: r.subcategoryId ? labels.subcategoryParentName(r.subcategoryId) ?? null : null,
      state: hit?.state ?? 'missing',
      includedByLabel: hit?.state === 'included' ? hit.expenseName : null,
      linkedExpenseId: hit?.expenseId ?? null,
      completion: r.completion ?? READINESS_COMPLETION.NOT_STARTED,
      owner: r.owner ?? '',
    };
  });

  const closed = items.filter((i) => i.state === 'covered' || i.state === 'included').length;
  const completed = items.filter((i) => i.completion === READINESS_COMPLETION.DONE).length;
  const total = items.length;
  return {
    defined: total > 0,
    items,
    completed,
    inProgress: items.filter((i) => i.completion === READINESS_COMPLETION.IN_PROGRESS).length,
    closed,
    missing: items.filter((i) => i.state === 'missing').length,
    total,
    percent: total > 0 ? Math.round((completed / total) * 100) : null,
    coveragePercent: total > 0 ? Math.round((closed / total) * 100) : null,
  };
}
