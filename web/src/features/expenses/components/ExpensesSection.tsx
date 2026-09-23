import { ChevronRight, Plus, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExpenseStatusBadge, OverdueBadge } from '@/components/StatusBadges';
import { LinkButton } from '@/design-system/Button';
import { Card } from '@/design-system/Card';
import { EmptyState, ErrorState, LoadingBlock, NoResultsState } from '@/design-system/feedback';
import { Field, Select } from '@/design-system/form';
import { Icon } from '@/design-system/Icon';
import { Section, Stack } from '@/design-system/layout';
import { FilterSheet } from '@/design-system/patterns';
import { Money } from '@/design-system/Typography';
import { EXPENSE_MANUAL_STATUSES } from '@/domain/constants';
import { useEventExpenses } from '@/features/queries';
import { NO_VENDOR_LABEL } from '@/features/reports/data/reportsRepository';
import type { ExpenseVM } from '../data/expensesRepository';
import styles from './ExpensesSection.module.css';

// Expenses of an event (Book 05 §9). A working list, not a ledger: category ← subcategory,
// counterparty, agreed / paid / remaining, status (manual or computed) and a derived overdue badge.

const STATUS_FILTERS = [...EXPENSE_MANUAL_STATUSES, 'שולם חלקית', 'שולם'] as const;

export function ExpenseRow({ expense }: { expense: ExpenseVM }) {
  const who = expense.artistName ?? expense.vendorName;
  const counterparty = who && who !== expense.name ? who : null;
  return (
    <li className={styles.item}>
      <Link to={`/events/${expense.eventId}/expenses/${expense.id}`} className={styles.link}>
        <div className={styles.main}>
          <p className={styles.crumb}>
            {expense.categoryName}
            {expense.subcategoryName && <> ← {expense.subcategoryName}</>}
          </p>
          <p className={styles.title}><bdi>{expense.name}</bdi></p>
          {counterparty && <p className={styles.sub}><bdi>{counterparty}</bdi></p>}
          <div className={styles.badges}>
            <ExpenseStatusBadge status={expense.computedStatus} />
            {expense.hasOverdue && <OverdueBadge />}
          </div>
        </div>
        <div className={styles.money}>
          <Money value={expense.agreedAmount} className={styles.agreed} />
          {expense.paidAmount > 0 && <span className={styles.small}>שולם <Money value={expense.paidAmount} /></span>}
          {expense.paidAmount > 0 && expense.remainingAmount !== 0 && <span className={styles.small}>נותר <Money value={expense.remainingAmount} signed /></span>}
        </div>
        <Icon icon={ChevronRight} size="sm" directional className={styles.chevron} />
      </Link>
    </li>
  );
}

/** Totals come from the event view-model (SQL), never re-summed here. */
export interface ExpenseTotals { count: number; agreed: number; paid: number; remaining: number }

export function ExpensesSection({ eventId, totals }: { eventId: string; totals: ExpenseTotals }) {
  const expenses = useEventExpenses(eventId);
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [vendor, setVendor] = useState('');

  const options = useMemo(() => {
    const cats = new Map<string, string>();
    const vendors = new Map<string, string>();
    for (const e of expenses.data ?? []) {
      cats.set(e.categoryId, e.categoryName);
      vendors.set(e.vendorId ?? '__none', e.vendorName ?? NO_VENDOR_LABEL);
    }
    return { cats: [...cats], vendors: [...vendors] };
  }, [expenses.data]);

  const visible = (expenses.data ?? []).filter((e) =>
    (!category || e.categoryId === category)
    && (!status || e.computedStatus === status)
    && (!vendor || (e.vendorId ?? '__none') === vendor));
  const activeCount = [category, status, vendor].filter(Boolean).length;
  const clear = () => { setCategory(''); setStatus(''); setVendor(''); };

  return (
    <Section
      id="expenses"
      title="הוצאות ותשלומים"
      count={totals.count}
      icon={Wallet}
      iconTone="brand"
      meta={<>סוכם <Money value={totals.agreed} /> · שולם <Money value={totals.paid} /> · נותר <Money value={totals.remaining} /></>}
      action={<LinkButton to={`/events/${eventId}/expenses/new`} variant="primary" tone="brand" compact icon={Plus}>הוסף הוצאה</LinkButton>}
    >
      {expenses.isLoading ? <LoadingBlock rows={3} height="88px" />
        : expenses.error ? <ErrorState onRetry={() => void expenses.refetch()} retrying={expenses.isFetching} />
          : expenses.data && expenses.data.length === 0 ? (
            <EmptyState compact title="אין עדיין הוצאות באירוע הזה" action={<LinkButton to={`/events/${eventId}/expenses/new`} variant="secondary" icon={Plus}>הוסף הוצאה</LinkButton>} />
          ) : (
            <Stack gap="1-5">
              {expenses.data && expenses.data.length > 3 && (
                <FilterSheet activeCount={activeCount} onClear={clear} title="סינון הוצאות">
                  <Field label="קטגוריה">
                    {(a) => (
                      <Select {...a} value={category} onChange={(e) => setCategory(e.target.value)} placeholder="הכול">
                        {options.cats.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                      </Select>
                    )}
                  </Field>
                  <Field label="סטטוס">
                    {(a) => (
                      <Select {...a} value={status} onChange={(e) => setStatus(e.target.value)} placeholder="הכול">
                        {STATUS_FILTERS.map((s) => <option key={s} value={s}>{s}</option>)}
                      </Select>
                    )}
                  </Field>
                  <Field label="ספק">
                    {(a) => (
                      <Select {...a} value={vendor} onChange={(e) => setVendor(e.target.value)} placeholder="הכול">
                        {options.vendors.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
                      </Select>
                    )}
                  </Field>
                </FilterSheet>
              )}
              {visible.length === 0 ? <NoResultsState onClear={clear} /> : (
                <Card padded={false}>
                  <ul className={styles.list}>{visible.map((e) => <ExpenseRow key={e.id} expense={e} />)}</ul>
                </Card>
              )}
            </Stack>
          )}
    </Section>
  );
}
