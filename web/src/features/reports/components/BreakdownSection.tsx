import { PieChart, Truck } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Icon } from '@/design-system/Icon';
import { Accordion, Card, Progress } from '@/design-system/Card';
import { EmptyState, ErrorState, LoadingBlock } from '@/design-system/feedback';
import { Section, Stack } from '@/design-system/layout';
import { SegmentedControl } from '@/design-system/patterns';
import { Money } from '@/design-system/Typography';
import { useBreakdown } from '@/features/queries';
import { formatNumber } from '@/lib/format';
import type { BreakdownLine } from '../data/reportsRepository';
import styles from './BreakdownSection.module.css';

// REPORTS inside an event (Book 05 §16, Book 04 §12). Lists + light progress bars instead of a
// chart library. Every sum comes from v_event_expense_breakdown and reconciles with the total.

function Line({ line, total }: { line: BreakdownLine; total: number }) {
  const share = total > 0 ? (line.amount / total) * 100 : 0;
  return (
    <div className={styles.line}>
      <div className={styles.lineHead}>
        <span className={styles.label}><bdi>{line.label}</bdi> <span className={styles.count}>({formatNumber(line.count)})</span></span>
        <Money value={line.amount} className={styles.amount} />
      </div>
      <Progress value={share} label={`${line.label}: ${Math.round(share)}% מסך ההוצאות`} />
    </div>
  );
}

export function BreakdownSection({ eventId, total }: { eventId: string; total: number }) {
  const breakdown = useBreakdown(eventId);
  const [dimension, setDimension] = useState<'category' | 'vendor'>('category');
  return (
    <Section id="reports" title="דוחות ופירוקים" meta={<>סה״כ הוצאות מוסכמות <Money value={total} /></>}>
      {breakdown.isLoading ? <LoadingBlock rows={2} height="64px" />
        : breakdown.error ? <ErrorState onRetry={() => void breakdown.refetch()} retrying={breakdown.isFetching} />
          : breakdown.data && breakdown.data.byCategory.length === 0 ? (
            <EmptyState compact title="אין עדיין הוצאות לפירוק" />
          ) : breakdown.data && (
            <Stack gap="1-5">
              <SegmentedControl
                label="סוג פירוק"
                value={dimension}
                onChange={setDimension}
                options={[{ value: 'category', label: 'לפי קטגוריה' }, { value: 'vendor', label: 'לפי ספק' }]}
              />
              {dimension === 'category' ? (
                breakdown.data.byCategory.map((c) => (
                  c.subcategories.length > 0 ? (
                    <Accordion
                      key={c.keyId ?? c.label}
                      icon={PieChart}
                      title={<bdi>{c.label}</bdi>}
                      meta={<Money value={c.amount} />}
                    >
                      <Stack gap="1-5">
                        <Line line={c} total={total} />
                        {c.subcategories.map((s) => <Line key={s.keyId ?? 'none'} line={s} total={c.amount} />)}
                      </Stack>
                    </Accordion>
                  ) : (
                    <Card key={c.keyId ?? c.label}><Line line={c} total={total} /></Card>
                  )
                ))
              ) : (
                <Card>
                  <Stack gap="1-5">
                    {breakdown.data.byVendor.map((v) => <Line key={v.keyId ?? 'none'} line={v} total={total} />)}
                  </Stack>
                </Card>
              )}
            </Stack>
          )}
    </Section>
  );
}

/** "ספקים ואנשי קשר" — people, not money (Book 04 §12.1). Only expenses that have a vendor. */
export function VendorsContactsSection({ vendors }: { vendors: { id: string; name: string; phone: string; expenseNames: string[] }[] }) {
  if (vendors.length === 0) return null;
  return (
    <Section id="vendors" title="ספקים ואנשי קשר">
      <Card padded={false}>
        <ul className={styles.contacts}>
          {vendors.map((v) => (
            <li key={v.id} className={styles.contact}>
              <Link to={`/vendors/${v.id}`} className={styles.contactName}><Icon icon={Truck} size="xs" /><bdi>{v.name}</bdi></Link>
              <span className={styles.count}><bdi>{v.expenseNames.join(' · ')}</bdi></span>
              {v.phone && <a href={`tel:${v.phone}`} className={`${styles.phone} num`} dir="ltr">{v.phone}</a>}
            </li>
          ))}
        </ul>
      </Card>
    </Section>
  );
}
