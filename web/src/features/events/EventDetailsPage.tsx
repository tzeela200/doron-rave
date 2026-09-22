import { CalendarDays, Copy, MapPin, Pencil } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { AppHeader } from '@/components/navigation/navigation';
import { LinkButton } from '@/design-system/Button';
import { Badge, Card } from '@/design-system/Card';
import { ErrorState, LoadingBlock } from '@/design-system/feedback';
import { Icon } from '@/design-system/Icon';
import { Inline, PageContainer, Section, Stack } from '@/design-system/layout';
import { Body } from '@/design-system/Typography';
import { LineupSection } from '@/features/artists/components/LineupSection';
import { ExpensesSection } from '@/features/expenses/components/ExpensesSection';
import { IncomeSection } from '@/features/income/components/IncomeSection';
import { NotesSection } from '@/features/notes/components/NotesSection';
import { useEventExpenses, useEventSummary, useVendors } from '@/features/queries';
import { ReadinessSection } from '@/features/readiness/components/ReadinessSection';
import { BreakdownSection, VendorsContactsSection } from '@/features/reports/components/BreakdownSection';
import { userMessage } from '@/lib/errors';
import { formatDate, formatDaysLabel, formatWeekday } from '@/lib/format';
import { EventFinancialOverview } from './components/EventFinancialOverview';
import styles from './EventDetailsPage.module.css';

// EVENT_DETAILS — the work centre of one event (Book 05 §7, ADR-026). Fixed order:
// Hero → Financial → Readiness → Expenses/Payments → Income/Tickets → Artists/Line-up →
// Vendors → Notes/Reminders → Reports. Each section loads and fails on its own.

export function EventDetailsPage() {
  const { eventId = '' } = useParams();
  const event = useEventSummary(eventId);

  if (event.isLoading) {
    return (
      <>
        <AppHeader title="פרטי אירוע" back="/events" />
        <PageContainer><LoadingBlock rows={4} height="120px" /></PageContainer>
      </>
    );
  }
  if (event.error || !event.data) {
    return (
      <>
        <AppHeader title="פרטי אירוע" back="/events" />
        <PageContainer><ErrorState message={userMessage(event.error, 'לא הצלחנו לטעון את הנתונים. נסה שוב.')} onRetry={() => void event.refetch()} /></PageContainer>
      </>
    );
  }

  const e = event.data;
  const days = formatDaysLabel(e.isArchived ? null : e.daysUntil);
  const readOnly = e.isArchived;

  return (
    <>
      <AppHeader
        title={e.name}
        back="/events"
        action={!readOnly ? <LinkButton to={`/events/${e.id}/edit`} variant="secondary" compact icon={Pencil}>ערוך</LinkButton> : undefined}
      />
      <PageContainer>
        <Card>
          <Stack gap="1-5">
            <Inline gap="1" justify="between">
              <Inline gap="2">
                <span className={styles.meta}><Icon icon={CalendarDays} size="sm" /><span className="num">{formatWeekday(e.eventDate)} · {formatDate(e.eventDate)}</span></span>
                {e.location && <span className={styles.meta}><Icon icon={MapPin} size="sm" /><bdi>{e.location}</bdi></span>}
              </Inline>
              {readOnly ? <Badge>בארכיון</Badge> : days && <Badge tone={e.isUpcoming ? 'accent' : 'neutral'}>{days}</Badge>}
            </Inline>
            {e.generalNotes && <Body compact className={styles.notes}>{e.generalNotes}</Body>}
            {!readOnly && (
              <Inline>
                <LinkButton to={`/events/${e.id}/clone`} variant="ghost" compact icon={Copy}>שכפל אירוע</LinkButton>
              </Inline>
            )}
          </Stack>
        </Card>

        <Section id="financial" title="תמונה פיננסית">
          <EventFinancialOverview event={e} />
        </Section>

        <ReadinessSection eventId={e.id} />
        <ExpensesSection eventId={e.id} agreedTotal={e.agreedExpenses} />
        <IncomeSection eventId={e.id} incomeTotal={e.incomeTotal} />
        <LineupSection eventId={e.id} artistsCount={e.artistsCount} />
        <EventVendors eventId={e.id} />
        <NotesSection entityType="event" entityId={e.id} />
        <BreakdownSection eventId={e.id} total={e.agreedExpenses} />
      </PageContainer>
    </>
  );
}

/** Vendors linked to this event's expenses, with their phone (from the cached vendor list). */
function EventVendors({ eventId }: { eventId: string }) {
  const expenses = useEventExpenses(eventId);
  const vendors = useVendors(true);
  if (!expenses.data || !vendors.data) return null;
  const byId = new Map(vendors.data.map((v) => [v.id, v]));
  const grouped = new Map<string, { id: string; name: string; phone: string; expenseNames: string[] }>();
  for (const ex of expenses.data) {
    if (!ex.vendorId) continue;
    const v = byId.get(ex.vendorId);
    const g = grouped.get(ex.vendorId) ?? { id: ex.vendorId, name: v?.name ?? ex.vendorName ?? '', phone: v?.phone ?? '', expenseNames: [] };
    g.expenseNames.push(ex.name);
    grouped.set(ex.vendorId, g);
  }
  return <VendorsContactsSection vendors={[...grouped.values()]} />;
}
