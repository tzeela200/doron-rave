import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/navigation/navigation';
import { Card } from '@/design-system/Card';
import { EmptyState, ErrorState, LoadingBlock } from '@/design-system/feedback';
import { Checkbox } from '@/design-system/form';
import { PageContainer, Section, Stack } from '@/design-system/layout';
import { Caption, Money } from '@/design-system/Typography';
import type { EventSummaryVM } from '@/features/events/data/eventsRepository';
import { useCategoryTotalsForEvents, useEvents, useEventsByIds } from '@/features/queries';
import { formatDate, formatNumber } from '@/lib/format';
import styles from './ComparePage.module.css';

// COMPARE_EVENTS (Book 05 §17, Book 07 F28). Every column uses the same canonical formulas
// (SQL views + domain/pnl). No metric exists here that does not exist elsewhere.

type Metric = { label: string; render: (e: EventSummaryVM) => React.ReactNode };

const unavailable = <span className={styles.muted}>לא ניתן לחשב</span>;

const METRICS: Metric[] = [
  { label: 'הכנסות', render: (e) => <Money value={e.incomeTotal} /> },
  { label: 'הוצאות מוסכמות', render: (e) => <Money value={e.agreedExpenses} /> },
  { label: 'יתרה', render: (e) => <Money value={e.balance} signed /> },
  { label: 'שולם', render: (e) => <Money value={e.paidTotal} /> },
  { label: 'נותר לשלם', render: (e) => <Money value={e.remainingToPay} /> },
  { label: 'הוצאות מתוכננות', render: (e) => <Money value={e.plannedExpenses} /> },
  { label: 'כרטיסים שנמכרו', render: (e) => <span className="num">{formatNumber(e.ticketsSold)}</span> },
  { label: 'נקודת איזון', render: (e) => (e.pnl.breakEvenTickets === null ? unavailable : <span className="num">{formatNumber(e.pnl.breakEvenTickets)}</span>) },
  {
    label: 'רווח צפוי / הפסד צפוי',
    render: (e) => (e.pnl.forecastProfit === null
      ? <span className={styles.muted}>אין תחזית</span>
      : <>{e.pnl.forecastProfit < 0 ? 'הפסד ' : 'רווח '}<Money value={Math.abs(e.pnl.forecastProfit)} /></>),
  },
];

export function ComparePage() {
  const [params, setParams] = useSearchParams();
  const ids = useMemo(() => (params.get('ids') ?? '').split(',').filter(Boolean), [params]);
  const all = useEvents('active');
  const selected = useEventsByIds(ids);
  const categories = useCategoryTotalsForEvents(ids);

  const toggle = (id: string) => {
    const next = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    setParams(next.length ? { ids: next.join(',') } : {}, { replace: true });
  };

  const events = (selected.data ?? []).slice().sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const categoryRows = useMemo(() => {
    const labels = new Map<string, string>();
    for (const m of categories.data?.values() ?? []) for (const [id, v] of m) labels.set(id, v.label);
    return [...labels];
  }, [categories.data]);

  return (
    <>
      <AppHeader title="השוואת אירועים" back="/events" />
      <PageContainer>
        <Section title="בחירת אירועים" meta="בחר לפחות שני אירועים">
          {all.isLoading ? <LoadingBlock rows={2} height="48px" />
            : all.error ? <ErrorState onRetry={() => void all.refetch()} />
              : (
                <Card>
                  {all.data?.map((e) => (
                    <Checkbox key={e.id} checked={ids.includes(e.id)} onChange={() => toggle(e.id)}
                      label={<bdi>{e.name}</bdi>} description={formatDate(e.eventDate) ?? undefined} />
                  ))}
                </Card>
              )}
        </Section>

        {ids.length < 2 ? (
          <EmptyState compact title="בחר לפחות שני אירועים להשוואה" />
        ) : selected.isLoading ? <LoadingBlock rows={3} />
          : selected.error ? <ErrorState onRetry={() => void selected.refetch()} />
            : (
              <Section title="השוואה">
                {/* Mobile: one card per metric, events stacked inside */}
                <Stack gap="1-5" className={styles.mobile}>
                  {METRICS.map((m) => (
                    <Card key={m.label}>
                      <p className={styles.metric}>{m.label}</p>
                      <dl className={styles.values}>
                        {events.map((e) => (
                          <div key={e.id} className={styles.value}><dt><bdi>{e.name}</bdi></dt><dd>{m.render(e)}</dd></div>
                        ))}
                      </dl>
                    </Card>
                  ))}
                  {categoryRows.length > 0 && (
                    <Card>
                      <p className={styles.metric}>הוצאות מוסכמות לפי קטגוריה</p>
                      {categoryRows.map(([id, label]) => (
                        <div key={id} className={styles.catBlock}>
                          <Caption>{label}</Caption>
                          <dl className={styles.values}>
                            {events.map((e) => (
                              <div key={e.id} className={styles.value}><dt><bdi>{e.name}</bdi></dt><dd><Money value={categories.data?.get(e.id)?.get(id)?.amount ?? 0} /></dd></div>
                            ))}
                          </dl>
                        </div>
                      ))}
                    </Card>
                  )}
                </Stack>

                {/* Desktop: a real RTL table */}
                <div className={styles.desktop}>
                  <Card padded={false}>
                    <table className={styles.table}>
                      <thead>
                        <tr>
                          <th scope="col">מדד</th>
                          {events.map((e) => <th key={e.id} scope="col"><bdi>{e.name}</bdi><br /><span className={styles.muted}>{formatDate(e.eventDate)}</span></th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {METRICS.map((m) => (
                          <tr key={m.label}><th scope="row">{m.label}</th>{events.map((e) => <td key={e.id}>{m.render(e)}</td>)}</tr>
                        ))}
                        {categoryRows.map(([id, label]) => (
                          <tr key={id}><th scope="row">{label}</th>{events.map((e) => <td key={e.id}><Money value={categories.data?.get(e.id)?.get(id)?.amount ?? 0} /></td>)}</tr>
                        ))}
                      </tbody>
                    </table>
                  </Card>
                </div>
              </Section>
            )}
      </PageContainer>
    </>
  );
}
