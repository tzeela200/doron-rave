import { CalendarDays, ChevronLeft, Clock, MapPin, Mic2 } from 'lucide-react';
import { InteractiveCard } from '@/design-system/Card';
import { Icon } from '@/design-system/Icon';
import { CardTitle, Money, cx } from '@/design-system/Typography';
import { formatDate, formatDaysLabel, formatNumber } from '@/lib/format';
import type { EventSummaryVM } from '../data/eventsRepository';
import { EventBanner } from './EventBanner';
import styles from './EventCard.module.css';

// Event card (Book 05 §4.2, §5.1; Book 06 §30). At most three financial facts, each only
// when it exists. Forecast and actual never share a label (ADR-060).
// Book 02 V3 §8: the shared EventBanner on top — the first thing the eye meets.

/** `featured` = the Home focal card (nearest active event): taller banner carrying the name and a
 *  visual "open" cue. The whole card is still the single link. */
export function EventCard({ event, state, featured = false }: { event: EventSummaryVM; state?: unknown; featured?: boolean }) {
  const { pnl } = event;
  const days = formatDaysLabel(event.isArchived ? null : event.daysUntil);
  const hasForecast = pnl.forecastProfit !== null;
  const forecastLoss = hasForecast && (pnl.forecastProfit ?? 0) < 0;

  return (
    <InteractiveCard to={`/events/${event.id}`} state={state} className={cx(styles.card, featured && styles.featured)}>
      <EventBanner hero={featured}>
        {days && <span className={styles.days}><Icon icon={Clock} size="xs" />{days}</span>}
        {featured && (
          <span className={styles.heroFoot}>
            <CardTitle as="h3" className={styles.heroTitle}>{event.name}</CardTitle>
            <span className={styles.cta}>לאירוע<Icon icon={ChevronLeft} size="xs" /></span>
          </span>
        )}
      </EventBanner>
      {!featured && (
        <div className={styles.head}>
          <CardTitle as="h3" className={styles.title}>{event.name}</CardTitle>
        </div>
      )}
      <div className={styles.meta}>
        <span className={styles.metaItem}><Icon icon={CalendarDays} size="xs" /><span className="num">{formatDate(event.eventDate)}</span></span>
        {event.location && <span className={styles.metaItem}><Icon icon={MapPin} size="xs" /><bdi>{event.location}</bdi></span>}
        {event.artistsCount > 0 && <span className={styles.metaItem}><Icon icon={Mic2} size="xs" />{formatNumber(event.artistsCount)} אמנים</span>}
      </div>
      <dl className={styles.facts}>
        {hasForecast ? (
          <div className={styles.fact}>
            <dt>{forecastLoss ? 'הפסד צפוי' : 'רווח צפוי'}</dt>
            <dd><Money value={Math.abs(pnl.forecastProfit ?? 0)} className={forecastLoss ? styles.loss : undefined} /></dd>
          </div>
        ) : (
          <div className={styles.fact}>
            <dt>יתרה</dt>
            <dd><Money value={event.balance} signed /></dd>
          </div>
        )}
        {event.remainingToPay > 0 && (
          <div className={styles.fact}>
            <dt>נותר לשלם</dt>
            <dd><Money value={event.remainingToPay} /></dd>
          </div>
        )}
        {pnl.breakEvenUnreachable ? (
          <div className={styles.fact}>
            <dt>נקודת איזון</dt>
            <dd className={styles.note}>הסבבים אינם מכסים את העלות</dd>
          </div>
        ) : pnl.breakEvenRemaining !== null && pnl.breakEvenRemaining > 0 ? (
          <div className={styles.fact}>
            <dt>נקודת איזון</dt>
            <dd className="num">עוד {formatNumber(pnl.breakEvenRemaining)} כרטיסים</dd>
          </div>
        ) : null}
      </dl>
    </InteractiveCard>
  );
}
