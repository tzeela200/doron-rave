import { useState } from 'react';
import { AppHeader } from '@/components/navigation/navigation';
import { EmptyState, ErrorState, LoadingBlock } from '@/design-system/feedback';
import { PageContainer, Section, Stack } from '@/design-system/layout';
import { SegmentedControl } from '@/design-system/patterns';
import { Caption } from '@/design-system/Typography';
import { ATTENTION_HORIZON_DAYS } from '@/domain/constants';
import { useUpcomingPayments } from '@/features/queries';
import { PaymentTimeline, UpcomingPaymentRow } from './components/UpcomingPaymentRow';

// PAYMENTS — upcoming / overdue (Book 07 F29, Book 04 §13–§14). Facts, sorted by due date.
// "This week" uses the central ATTENTION_HORIZON_DAYS constant. Nothing becomes a task.

type Scope = 'all' | 'week' | 'overdue';

export function UpcomingPaymentsPage() {
  const payments = useUpcomingPayments();
  const [scope, setScope] = useState<Scope>('all');
  const rows = (payments.data ?? []).filter((p) =>
    scope === 'overdue' ? p.isOverdue : scope === 'week' ? !p.isOverdue && p.daysUntilDue <= ATTENTION_HORIZON_DAYS : true);

  return (
    <>
      <AppHeader title="תשלומים" back="/" subtitle="תשלומים שטרם שולמו, עם מועד, באירועים פעילים" />
      <PageContainer>
        <Stack gap="1-5">
          <SegmentedControl
            label="טווח"
            value={scope}
            onChange={setScope}
            options={[{ value: 'all', label: 'הכול' }, { value: 'week', label: 'השבוע' }, { value: 'overdue', label: 'באיחור' }]}
          />
          {payments.data && <Caption>{rows.length} תשלומים</Caption>}
        </Stack>
        <Section title="לפי מועד">
          {payments.isLoading ? <LoadingBlock rows={3} height="72px" />
            : payments.error ? <ErrorState onRetry={() => void payments.refetch()} retrying={payments.isFetching} />
              : rows.length === 0 ? <EmptyState compact title="אין תשלומים בטווח הזה" />
                : (
                  <PaymentTimeline>{rows.map((p) => <UpcomingPaymentRow key={p.paymentId} payment={p} />)}</PaymentTimeline>
                )}
        </Section>
      </PageContainer>
    </>
  );
}
