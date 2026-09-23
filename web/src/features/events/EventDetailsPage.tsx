import { CalendarDays, Clock, Copy, MapPin, Pencil } from 'lucide-react';
import { useParams } from 'react-router-dom';
import { AppHeader } from '@/components/navigation/navigation';
import { LinkButton } from '@/design-system/Button';
import { Badge, Card } from '@/design-system/Card';
import { ErrorState, LoadingBlock } from '@/design-system/feedback';
import { Icon } from '@/design-system/Icon';
import { CollapsibleSections, Inline, PageContainer, Section } from '@/design-system/layout';
import { Body } from '@/design-system/Typography';
import { eventDurationMinutes } from '@/domain/lineup';
import { LineupSection } from '@/features/artists/components/LineupSection';
import { ExpensesSection } from '@/features/expenses/components/ExpensesSection';
import { IncomeSection } from '@/features/income/components/IncomeSection';
import { NotesSection } from '@/features/notes/components/NotesSection';
import { useEventExpenses, useEventSummary, useVendors } from '@/features/queries';
import { ReadinessSection } from '@/features/readiness/components/ReadinessSection';
import { BreakdownSection, VendorsContactsSection } from '@/features/reports/components/BreakdownSection';
import { userMessage } from '@/lib/errors';
import { formatDate, formatDaysLabel, formatDuration, formatWeekday } from '@/lib/format';
import { EventBanner } from './components/EventBanner';
import { EventFinancialOverview } from './components/EventFinancialOverview';
import styles from './EventDetailsPage.module.css';

// EVENT_DETAILS — the work centre of one event (Book 05 §7, ADR-026). Fixed order:
// Hero → Financial → Readiness → Expenses/Payments → Income/Tickets → Artists/Line-up →
// Vendors → Notes/Reminders → Reports. Each section loads and fails on its own.
// Summary → Financial → accordions (Top Design Review §13, UX addendum §6). Readiness is the first
// accordion and opens by itself when a list is defined (addendum: "פתוח אם מוגדר"); the rest are
// closed with count + summary. Hero and financial overview stay visible.

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
        <Card variant="summary" className={styles.hero}>
          <EventBanner imagePath={e.imagePath}>{readOnly ? <Badge>בארכיון</Badge> : days && <Badge tone={e.isUpcoming ? 'accent' : 'neutral'}>{days}</Badge>}</EventBanner>
          <dl className={styles.facts}>
            <div className={styles.fact}>
              <dt><Icon icon={CalendarDays} size="xs" />תאריך</dt>
              <dd><span className="num">{formatDate(e.eventDate)}</span><span className={styles.sub}>{formatWeekday(e.eventDate)}</span></dd>
            </div>
            {(e.startTime || e.endTime) && (
              <div className={styles.fact}>
                <dt><Icon icon={Clock} size="xs" />שעות</dt>
                <dd><EventHours start={e.startTime} end={e.endTime} /></dd>
              </div>
            )}
            {e.location && (
              <div className={styles.fact}>
                <dt><Icon icon={MapPin} size="xs" />מקום</dt>
                <dd><bdi>{e.location}</bdi></dd>
              </div>
            )}
          </dl>
          {e.generalNotes && <Body compact className={styles.notes}>{e.generalNotes}</Body>}
          {!readOnly && (
            <Inline>
              <LinkButton to={`/events/${e.id}/clone`} variant="ghost" compact icon={Copy}>שכפל אירוע</LinkButton>
            </Inline>
          )}
        </Card>

        <Section id="financial" title="תמונה פיננסית">
          <EventFinancialOverview event={e} />
        </Section>

        <CollapsibleSections>
          <ReadinessSection eventId={e.id} />
          <ExpensesSection eventId={e.id} totals={{ count: e.expensesCount, agreed: e.agreedExpenses, paid: e.paidTotal, remaining: e.remainingToPay }} />
          <IncomeSection eventId={e.id} incomeTotal={e.incomeTotal} />
          <LineupSection eventId={e.id} artistsCount={e.artistsCount} />
          <EventVendors eventId={e.id} />
          <NotesSection entityType="event" entityId={e.id} />
          <BreakdownSection eventId={e.id} total={e.agreedExpenses} />
        </CollapsibleSections>
      </PageContainer>
    </>
  );
}

/** Addendum §4: "22:00–07:00" (+ derived duration); one hour alone is shown alone; never 00:00. */
function EventHours({ start, end }: { start: string | null; end: string | null }) {
  if (start && end) {
    const duration = formatDuration(eventDurationMinutes(start, end));
    return <><span className="num" dir="ltr">{start}–{end}</span>{duration && <span className={styles.sub}>{duration}</span>}</>;
  }
  if (start) return <span>התחלה <span className="num">{start}</span></span>;
  return <span>סיום <span className="num">{end}</span></span>;
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
