import { ChevronRight } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { OverdueBadge, PaymentStatusBadge } from '@/components/StatusBadges';
import { Icon } from '@/design-system/Icon';
import { Money, cx } from '@/design-system/Typography';
import { formatDate, formatDayMonth } from '@/lib/format';
import type { UpcomingPaymentVM } from '@/features/expenses/data/expensesRepository';
import styles from './PaymentRows.module.css';

/** Upcoming payments as a timeline (Top Design Review §5): a rail, one small card per payment. */
export function PaymentTimeline({ children, label = 'תשלומים לפי מועד' }: { children: ReactNode; label?: string }) {
  return <ol className={styles.timeline} aria-label={label}>{children}</ol>;
}

/** An upcoming payment as a fact (ADR-021): due date, amount, status. Opens the expense. */
export function UpcomingPaymentRow({ payment, showEvent = true }: { payment: UpcomingPaymentVM; showEvent?: boolean }) {
  const chip = formatDayMonth(payment.dueDate);
  return (
    <li className={cx(styles.tlItem, payment.isOverdue && styles.tlOverdue)}>
      <Link to={`/events/${payment.eventId}/expenses/${payment.expenseId}`} className={styles.tlCard}>
        {chip && (
          <span className={styles.dateChip} aria-hidden="true">
            <span className={`${styles.dateDay} num`}>{chip.day}</span>
            <span className={styles.dateMonth}>{chip.month}</span>
          </span>
        )}
        <div className={styles.main}>
          <p className={styles.title}><bdi>{payment.expenseName}</bdi></p>
          <p className={styles.sub}>
            {showEvent && <><bdi>{payment.eventName}</bdi> · </>}
            <span className="num">מועד {formatDate(payment.dueDate)}</span>
          </p>
          <div className={styles.badges}>
            <PaymentStatusBadge status={payment.status} />
            {payment.isOverdue && <OverdueBadge />}
          </div>
        </div>
        <div className={styles.end}>
          <Money value={payment.amount} className={styles.amountLg} />
          <Icon icon={ChevronRight} size="sm" directional className={styles.chevron} />
        </div>
      </Link>
    </li>
  );
}
