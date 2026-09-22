import { AppError, MESSAGES, toAppError } from './errors';
import { formatDaysLabel, formatDuration, formatMoney } from './format';
import { qk } from './query/keys';
import { refresh } from './query/refresh';

describe('error model (Book 08 §25, Book 11 §13)', () => {
  it('maps a database domain error to canonical Hebrew copy', () => {
    const e = toAppError({ code: 'P0001', message: 'DOMAIN:performance_times_equal' }, 'saveExpense');
    expect(e.kind).toBe('DOMAIN');
    expect(e.userMessage).toBe('שעת ההתחלה ושעת הסיום לא יכולות להיות זהות');
  });
  it('never exposes a raw database error', () => {
    const e = toAppError({ code: '23503', message: 'insert or update on table "expenses" violates foreign key constraint' }, 'saveExpense');
    expect(e.userMessage).toBe(MESSAGES.save);
    expect(e.userMessage).not.toMatch(/violates|table|constraint/);
  });
  it('recognises network failure', () => {
    expect(toAppError(new TypeError('Failed to fetch'), 'savePayment').kind).toBe('NETWORK');
  });
  it('recognises missing permission', () => {
    const e = toAppError({ code: '42501', message: 'permission denied' }, 'saveIncome');
    expect(e.kind).toBe('AUTH');
    expect(e.userMessage).toBe(MESSAGES.auth);
  });
  it('passes AppError through untouched', () => {
    const original = new AppError('VALIDATION', 'x', 'הודעה', 'op');
    expect(toAppError(original, 'other')).toBe(original);
  });
});

describe('formatters (Book 06 §45)', () => {
  it('null is never rendered as 0', () => {
    expect(formatMoney(null)).toBeNull();
    expect(formatMoney(undefined)).toBeNull();
    expect(formatDuration(null)).toBeNull();
    expect(formatDaysLabel(null)).toBeNull();
  });
  it('money keeps sign, ₪ and agorot only when needed', () => {
    expect(formatMoney(1250)).toContain('₪1,250');
    expect(formatMoney(299.7)).toContain('₪299.70');
    expect(formatMoney(-5500.3)).toContain('-₪5,500.30');
  });
  it('duration uses the legacy Hebrew wording', () => {
    expect(formatDuration(120)).toBe('שעתיים');
    expect(formatDuration(60)).toBe('שעה');
    expect(formatDuration(90)).toBe('1:30 שעות');
    expect(formatDuration(45)).toBe('45 דקות');
  });
});

describe('refresh matrix (Book 07 §41)', () => {
  const has = (keys: readonly (readonly unknown[])[], key: readonly unknown[]) => keys.some((k) => JSON.stringify(k) === JSON.stringify(key));
  it('required items refresh readiness only — never money', () => {
    const keys = refresh.requiredItems('e1');
    expect(keys).toEqual([qk.event.readiness('e1')]);
  });
  it('a payment refreshes expense, event money, upcoming payments and home', () => {
    const keys = refresh.payment('e1', 'x1');
    for (const k of [qk.expense.root('x1'), qk.event.financial('e1'), qk.event.expenses('e1'), qk.upcomingPayments, qk.home]) {
      expect(has(keys, k)).toBe(true);
    }
  });
  it('income refreshes P&L inputs and home, not expenses', () => {
    const keys = refresh.income('e1');
    expect(has(keys, qk.event.income('e1'))).toBe(true);
    expect(has(keys, qk.event.financial('e1'))).toBe(true);
    expect(has(keys, qk.event.expenses('e1'))).toBe(false);
  });
  it('notes refresh only their own entity', () => {
    expect(refresh.notes('event', 'e1')).toEqual([qk.notes('event', 'e1')]);
  });
});
