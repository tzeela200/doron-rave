import { z } from 'zod';
import { EXPENSE_MANUAL_STATUS, COVERAGE_LABEL_MAX } from '@/domain/constants';
import { validatePerformanceTimes, type PerformanceTimesError } from '@/domain/lineup';
import { parseAmount } from '@/domain/money';
import type { ExpenseInput, ExpenseVM } from './data/expensesRepository';

// Expense form contract (Book 08 §18): schema, defaults adapter, single payload builder.
// save_expense() re-validates everything on the server; this is the fast client layer.

export const TIME_ERRORS: Record<PerformanceTimesError, string> = {
  end_missing: 'יש להזין גם שעת סיום',
  start_missing: 'יש להזין גם שעת התחלה',
  equal: 'שעת ההתחלה ושעת הסיום לא יכולות להיות זהות',
  invalid: 'יש להזין שעה בפורמט 24 שעות',
};

const money = z.string().refine((v) => v.trim() === '' || (parseAmount(v) ?? -1) >= 0, 'יש להזין סכום תקין');

export const expenseFormSchema = z
  .object({
    name: z.string().trim().min(1, 'יש להזין שם הוצאה'),
    categoryId: z.string().min(1, 'יש לבחור קטגוריה'),
    subcategoryId: z.string(),
    vendorId: z.string(),
    artistId: z.string(),
    plannedAmount: money,
    agreedAmount: money,
    manualStatus: z.enum([EXPENSE_MANUAL_STATUS.PLANNED, EXPENSE_MANUAL_STATUS.AGREED]),
    startTime: z.string(),
    endTime: z.string(),
    expenseDate: z.string(),
    paidBy: z.string(),
    internalNotes: z.string(),
    includesExtras: z.boolean(),
    coverageKeys: z.array(z.string()),
    customLabels: z.array(z.object({ value: z.string().max(COVERAGE_LABEL_MAX, `עד ${COVERAGE_LABEL_MAX} תווים`) })),
    // simple payment — create only
    isPaid: z.boolean(),
    dueDate: z.string(),
    paymentMethodId: z.string(),
  })
  .superRefine((v, ctx) => {
    const err = validatePerformanceTimes(v.startTime, v.endTime);
    if (err === 'start_missing') ctx.addIssue({ code: 'custom', path: ['startTime'], message: TIME_ERRORS[err] });
    else if (err) ctx.addIssue({ code: 'custom', path: ['endTime'], message: TIME_ERRORS[err] });
  });

export type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

export function emptyExpenseForm(categoryId = ''): ExpenseFormValues {
  return {
    name: '', categoryId, subcategoryId: '', vendorId: '', artistId: '',
    plannedAmount: '', agreedAmount: '', manualStatus: EXPENSE_MANUAL_STATUS.PLANNED,
    startTime: '', endTime: '', expenseDate: '', paidBy: '', internalNotes: '',
    includesExtras: false, coverageKeys: [], customLabels: [],
    isPaid: false, dueDate: '', paymentMethodId: '',
  };
}

export function expenseToForm(e: ExpenseVM): ExpenseFormValues {
  return {
    name: e.name,
    categoryId: e.categoryId,
    subcategoryId: e.subcategoryId ?? '',
    vendorId: e.vendorId ?? '',
    artistId: e.artistId ?? '',
    plannedAmount: e.plannedAmount ? String(e.plannedAmount) : '',
    agreedAmount: e.agreedAmount ? String(e.agreedAmount) : '',
    manualStatus: e.manualStatus === EXPENSE_MANUAL_STATUS.AGREED ? EXPENSE_MANUAL_STATUS.AGREED : EXPENSE_MANUAL_STATUS.PLANNED,
    startTime: e.startTime ?? '',
    endTime: e.endTime ?? '',
    expenseDate: e.expenseDate ?? '',
    paidBy: e.paidBy,
    internalNotes: e.internalNotes,
    includesExtras: e.coverage.length > 0,
    coverageKeys: e.coverage.filter((c) => !c.customLabel).map((c) => (c.subcategoryId ? `sub:${c.subcategoryId}` : `cat:${c.categoryId}`)),
    customLabels: e.coverage.filter((c) => c.customLabel).map((c) => ({ value: c.customLabel ?? '' })),
    isPaid: false,
    dueDate: '',
    paymentMethodId: '',
  };
}

export function formToExpenseInput(v: ExpenseFormValues, ctx: { eventId: string; id?: string; isArtist: boolean }): ExpenseInput {
  const coverage = v.includesExtras
    ? [
        ...v.coverageKeys.map((k) => {
          const id = k.slice(4);
          return k.startsWith('sub:')
            ? { categoryId: null, subcategoryId: id, customLabel: null }
            : { categoryId: id, subcategoryId: null, customLabel: null };
        }),
        ...v.customLabels.map((l) => l.value.trim()).filter(Boolean).map((label) => ({ categoryId: null, subcategoryId: null, customLabel: label })),
      ]
    : [];
  return {
    id: ctx.id,
    eventId: ctx.eventId,
    name: v.name,
    categoryId: v.categoryId,
    subcategoryId: ctx.isArtist ? null : v.subcategoryId || null,
    plannedAmount: parseAmount(v.plannedAmount) ?? 0,
    agreedAmount: parseAmount(v.agreedAmount) ?? 0,
    vendorId: v.vendorId || null,
    artistId: v.artistId || null,
    paidBy: v.paidBy,
    manualStatus: v.manualStatus,
    expenseDate: v.expenseDate || null,
    internalNotes: v.internalNotes,
    startTime: ctx.isArtist && v.startTime ? v.startTime : null,
    endTime: ctx.isArtist && v.endTime ? v.endTime : null,
    coverage,
    // Simple payment mode applies on creation only; afterwards payments are managed directly.
    simplePayment: ctx.id ? null : { isPaid: v.isPaid, dueDate: v.dueDate || null, paymentMethodId: v.paymentMethodId || null },
  };
}
