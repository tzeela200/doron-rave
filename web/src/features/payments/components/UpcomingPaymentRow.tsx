import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { OverdueBadge, PaymentStatusBadge } from '@/components/StatusBadges';
import { Icon } from '@/design-system/Icon';
import { Money } from '@/design-system/Typography';
import { formatDate } from '@/lib/format';
import type { UpcomingPaymentVM } from '@/features/expenses/data/expensesRepository';
import styles from './PaymentRows.module.css';

/** An upcoming payment as a fact (ADR-021): amount, due date, status. Opens the expense. */
export function UpcomingPaymentRow({ payment, showEvent = true }: { payment: UpcomingPaymentVM; showEvent?: boolean }) {
  return (
    <li className={styles.item}>
      <Link to={`/events/${payment.eventId}/expenses/${payment.expenseId}`} className={styles.link}>
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
          <Money value={payment.amount} className={styles.amount} />
          <Icon icon={ChevronRight} size="sm" directional className={styles.chevron} />
        </div>
      </Link>
    </li>
  );
}
