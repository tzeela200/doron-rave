import { Banknote, CircleDollarSign, Scale, TrendingUp, Wallet } from 'lucide-react';
import { Card, IconTile, KpiCard, Progress } from '@/design-system/Card';
import { InlineMessage } from '@/design-system/feedback';
import { Stack } from '@/design-system/layout';
import { Caption, Label, Money } from '@/design-system/Typography';
import { formatMoney, formatNumber } from '@/lib/format';
import type { EventSummaryVM } from '../data/eventsRepository';
import styles from './EventFinancialOverview.module.css';

// Financial overview of one event (Book 05 §7.1, Book 06 §31). A hierarchy, not a grid of ten
// equal KPIs: core actuals → planning → tickets → forecast. Receives a ready view-model; the
// formulas live in SQL views and src/domain/pnl.ts only. Colours follow Book 02 V3 §5:
// income teal, remaining-to-pay orange, profit/loss green/red, agreed expenses neutral.

export function EventKpis({ event }: { event: EventSummaryVM }) {
  return (
    <div className={styles.kpis}>
      <KpiCard label="הכנסות" icon={Banknote} tone="teal" value={formatMoney(event.incomeTotal)} />
      <KpiCard label="הוצאות מוסכמות" icon={Wallet} tone="neutral" value={formatMoney(event.agreedExpenses)} />
      <KpiCard label="יתרה" icon={Scale} tone={event.balance < 0 ? 'danger' : 'success'} value={formatMoney(event.balance)} negative={event.balance < 0} meta="הכנסות פחות הוצאות מוסכמות" />
      <KpiCard label="נותר לשלם" icon={CircleDollarSign} tone="brand" value={formatMoney(event.remainingToPay)} meta={<>שולם <Money value={event.paidTotal} /></>} />
    </div>
  );
}

export function EventFinancialOverview({ event }: { event: EventSummaryVM }) {
  const { pnl } = event;
  const forecastLoss = (pnl.forecastProfit ?? 0) < 0;
  const priceSource = pnl.averageTicketPriceUsed === null
    ? null
    : event.averageTicketPrice !== null && event.averageTicketPrice > 0
      ? 'מחיר כרטיס ממוצע שהוזן'
      : 'ממוצע המכירות בפועל';

  return (
    <Stack gap="1-5">
      <EventKpis event={event} />
      <Card>
        <dl className={styles.rows}>
          <div className={styles.row}>
            <dt>הוצאות מתוכננות</dt>
            <dd><Money value={event.plannedExpenses} /></dd>
          </div>
          <div className={styles.row}>
            <dt>כרטיסים שנמכרו</dt>
            <dd className="num">{formatNumber(pnl.ticketsSold)}</dd>
          </div>
          <div className={styles.row}>
            <dt>נקודת איזון</dt>
            <dd>
              {pnl.breakEvenUnreachable ? <span className={styles.muted}>לא ניתן להגיע</span>
                : pnl.breakEvenTickets === null ? <span className={styles.muted}>לא ניתן לחשב</span>
                  : <span className="num">{formatNumber(pnl.breakEvenTickets)} כרטיסים</span>}
            </dd>
          </div>
          {pnl.breakEvenRemaining !== null && (
            <div className={styles.row}>
              <dt>כרטיסים שנותרו לנקודת איזון</dt>
              <dd className="num">{formatNumber(pnl.breakEvenRemaining)}</dd>
            </div>
          )}
        </dl>

        {pnl.breakEvenTickets !== null && pnl.breakEvenTickets > 0 && (
          <div className={styles.progress}>
            <Progress
              value={(pnl.ticketsSold / pnl.breakEvenTickets) * 100}
              label={`נמכרו ${formatNumber(pnl.ticketsSold)} מתוך ${formatNumber(pnl.breakEvenTickets)} כרטיסים לנקודת האיזון`}
              tone={pnl.breakEvenRemaining === 0 ? 'success' : 'brand'}
            />
            <Caption>נמכרו {formatNumber(pnl.ticketsSold)} מתוך {formatNumber(pnl.breakEvenTickets)} לנקודת האיזון</Caption>
          </div>
        )}

        {pnl.breakEvenUnreachable && (
          <div className={styles.progress}>
            <InlineMessage tone="warning" title="סבבי הכרטיסים שהוגדרו אינם מכסים את העלות המתוכננת." />
          </div>
        )}

        {priceSource && !pnl.usesTiers && (
          <Caption className={styles.basis}>
            מחיר לחישוב: <Money value={pnl.averageTicketPriceUsed} /> · {priceSource}
          </Caption>
        )}
        {pnl.usesTiers && <Caption className={styles.basis}>החישוב לפי סבבי הכרטיסים, בסדר המכירה</Caption>}
      </Card>

      <Card>
        <div className={styles.forecastHead}>
          <IconTile icon={TrendingUp} tone={forecastLoss ? 'danger' : 'success'} />
          <Label as="h3">{pnl.forecastProfit === null ? 'רווח צפוי' : forecastLoss ? 'הפסד צפוי' : 'רווח צפוי'}</Label>
        </div>
        {pnl.forecastProfit === null ? (
          <p className={styles.muted}>אין מספיק נתונים להצגת תחזית.</p>
        ) : (
          <>
            <p className={forecastLoss ? styles.forecastLoss : styles.forecastValue}>
              <Money value={Math.abs(pnl.forecastProfit)} />
            </p>
            <Caption>
              {pnl.usesTiers
                ? <>תחזית לפי סבבי הכרטיסים: {formatNumber(pnl.expectedTicketCount)} כרטיסים · <Money value={pnl.forecastTicketIncome} /></>
                : <>תחזית לפי {formatNumber(pnl.expectedTicketCount)} כרטיסים צפויים · <Money value={pnl.forecastTicketIncome} /></>}
              {pnl.nonTicketIncome > 0 && <> · הכנסות שאינן כרטיסים <Money value={pnl.nonTicketIncome} /></>}
            </Caption>
          </>
        )}
      </Card>
    </Stack>
  );
}
