import { Banknote, CalendarDays, CircleDollarSign, FolderTree, Mic2, Plus, Truck } from 'lucide-react';
import { AppHeader, QuickAction } from '@/components/navigation/navigation';
import { FloatingCreateButton, LinkButton } from '@/design-system/Button';
import { Card, KpiCard } from '@/design-system/Card';
import { EmptyState, ErrorState, LoadingBlock } from '@/design-system/feedback';
import { Grid, PageContainer, Section } from '@/design-system/layout';
import { Money } from '@/design-system/Typography';
import { todayIso } from '@/domain/dates';
import { useEvents, useHomeSummary, useUpcomingPayments } from '@/features/queries';
import { formatDate, formatMoney, formatNumber, formatWeekday } from '@/lib/format';
import { EventCard } from '@/features/events/components/EventCard';
import { PaymentTimeline, UpcomingPaymentRow } from '@/features/payments/components/UpcomingPaymentRow';
import styles from './HomePage.module.css';

// Home = Control Room (Book 05 §4, ADR-018/019/020/021). KPIs on top, active events, the four
// approved shortcuts, and upcoming payments as FACTS. No "לטיפול עכשיו", no invented tasks.

const HOME_PAYMENTS_LIMIT = 5;

export function HomePage() {
  const summary = useHomeSummary();
  const events = useEvents('upcoming');
  const payments = useUpcomingPayments(HOME_PAYMENTS_LIMIT);
  const today = todayIso();

  return (
    <>
      <AppHeader brand title="בית" subtitle={<span className="num">{formatWeekday(today)} · {formatDate(today)}</span>} />
      <PageContainer>
        <section aria-label="מדדים מרכזיים">
          {summary.isLoading ? (
            <LoadingBlock rows={1} height="112px" />
          ) : summary.error ? (
            <ErrorState onRetry={() => void summary.refetch()} retrying={summary.isFetching} />
          ) : summary.data && (
            <div className={styles.kpis}>
              <KpiCard label="אירועים פעילים" icon={CalendarDays} tone="teal" value={formatNumber(summary.data.activeEventsCount)} />
              <KpiCard label="נותר לשלם" icon={CircleDollarSign} tone="brand" value={formatMoney(summary.data.remainingToPay)}
                meta={<>שולם <Money value={summary.data.paidTotal} /> מתוך <Money value={summary.data.agreedExpenses} /></>} />
              <KpiCard label="הכנסות" icon={Banknote} tone="teal" value={formatMoney(summary.data.incomeTotal)}
                meta={summary.data.ticketsSold > 0 ? <>כרטיסים שנמכרו: <span className="num">{formatNumber(summary.data.ticketsSold)}</span></> : undefined} />
            </div>
          )}
        </section>

        <Section className={styles.focal} title="אירועים פעילים" action={<LinkButton to="/events" variant="ghost" compact>כל האירועים</LinkButton>}>
          {events.isLoading ? <LoadingBlock rows={2} height="160px" />
            : events.error ? <ErrorState onRetry={() => void events.refetch()} retrying={events.isFetching} />
              : events.data && events.data.length === 0 ? (
                <EmptyState title="אין אירועים פעילים" action={<LinkButton to="/events/new" variant="primary" icon={Plus}>צור אירוע</LinkButton>} />
              ) : (
                <Grid columns={2}>
                  {events.data?.map((e, i) => <EventCard key={e.id} event={e} featured={i === 0} />)}
                </Grid>
              )}
        </Section>

        <Section className={styles.calm} title="גישה מהירה">
          <div className={styles.quick}>
            <QuickAction to="/artists" label="אמנים וליין־אפ" icon={Mic2} tone="teal" />
            <QuickAction to="/categories" label="קטגוריות" icon={FolderTree} tone="success" />
            <QuickAction to="/vendors" label="ספקים" icon={Truck} tone="neutral" />
            <QuickAction to="/events" label="אירועים" icon={CalendarDays} tone="brand" />
          </div>
        </Section>

        <Section
          title="תשלומים קרובים"
          action={<LinkButton to="/payments" variant="ghost" compact>כל התשלומים</LinkButton>}
        >
          {payments.isLoading ? <LoadingBlock rows={2} height="64px" />
            : payments.error ? <ErrorState onRetry={() => void payments.refetch()} retrying={payments.isFetching} />
              : payments.data && payments.data.length === 0 ? (
                <EmptyState compact title="אין תשלומים קרובים" />
              ) : (
                <PaymentTimeline>
                  {payments.data?.map((p) => <UpcomingPaymentRow key={p.paymentId} payment={p} />)}
                </PaymentTimeline>
              )}
        </Section>

        {summary.data && summary.data.activeEventsCount > 0 && (
          <Section className={styles.open} title="סיכום כספי — אירועים פעילים">
            <Card variant="summary">
              <dl className={styles.summary}>
                <div><dt>הוצאות מתוכננות</dt><dd><Money value={summary.data.plannedExpenses} /></dd></div>
                <div><dt>הוצאות מוסכמות</dt><dd><Money value={summary.data.agreedExpenses} /></dd></div>
                <div><dt>שולם</dt><dd><Money value={summary.data.paidTotal} /></dd></div>
              </dl>
            </Card>
          </Section>
        )}
      </PageContainer>
      <FloatingCreateButton icon={Plus} label="צור אירוע" to="/events/new" />
    </>
  );
}
