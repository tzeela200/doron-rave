import { AlertTriangle, Plus } from 'lucide-react';
import { Link } from 'react-router-dom';
import { LinkButton } from '@/design-system/Button';
import { Card } from '@/design-system/Card';
import { EmptyState, ErrorState, LoadingBlock } from '@/design-system/feedback';
import { Icon } from '@/design-system/Icon';
import { Section, Stack } from '@/design-system/layout';
import { Money } from '@/design-system/Typography';
import { buildLineup, type LineupSlot } from '@/domain/lineup';
import { useEventExpenses } from '@/features/queries';
import { formatDuration, formatNumber } from '@/lib/format';
import styles from './LineupSection.module.css';

// "אמנים וליין־אפ" inside an event. The artists count comes from expenses with an artist, the
// line-up only from artist expenses that have both times (Book 04 §11, §11.1).

export function LineupRow({ slot, eventId }: { slot: LineupSlot; eventId: string }) {
  return (
    <li className={styles.item}>
      <Link to={`/events/${eventId}/expenses/${slot.expenseId}`} className={styles.row}>
        <span className={`${styles.time} num`} dir="ltr">{slot.start}–{slot.end}</span>
        <span className={styles.main}>
          <span className={styles.name}><bdi>{slot.displayName}</bdi></span>
          {slot.realName && <span className={styles.sub}><bdi>{slot.realName}</bdi></span>}
          {slot.overlapsWith.length > 0 && (
            <span className={styles.overlap}>
              <Icon icon={AlertTriangle} size="xs" />
              חפיפה בשעות עם {slot.overlapsWith.join(', ')}
            </span>
          )}
        </span>
        <span className={styles.end}>
          <span>{formatDuration(slot.durationMinutes)}</span>
          {slot.hourlyCost !== null && <span className={styles.sub}><Money value={slot.hourlyCost} /> לשעה</span>}
        </span>
      </Link>
    </li>
  );
}

export function LineupSection({ eventId, artistsCount }: { eventId: string; artistsCount: number }) {
  const expenses = useEventExpenses(eventId);
  const artistExpenses = (expenses.data ?? []).filter((e) => e.isArtist || e.artistId);
  const lineup = buildLineup(artistExpenses.map((e) => ({
    expenseId: e.id,
    artistId: e.artistId,
    displayName: e.artistName ?? e.name,
    realName: e.artistRealName,
    start: e.startTime,
    end: e.endTime,
    agreedAmount: e.agreedAmount,
  })));
  const withoutTimes = artistExpenses.filter((e) => !lineup.some((s) => s.expenseId === e.id));

  return (
    <Section
      id="lineup"
      title="אמנים וליין־אפ"
      meta={`${formatNumber(artistsCount)} אמנים באירוע`}
      action={<LinkButton to={`/events/${eventId}/expenses/new?artist=1`} variant="secondary" compact icon={Plus}>הוסף אמן</LinkButton>}
    >
      {expenses.isLoading ? <LoadingBlock rows={2} height="64px" />
        : expenses.error ? <ErrorState onRetry={() => void expenses.refetch()} retrying={expenses.isFetching} />
          : artistExpenses.length === 0 ? (
            <EmptyState compact title="אין עדיין אמנים באירוע הזה" />
          ) : (
            <Stack gap="1-5">
              {lineup.length > 0 && (
                <Card padded={false}>
                  <ol className={styles.list} aria-label="ליין־אפ לפי סדר הלילה">
                    {lineup.map((s) => <LineupRow key={s.expenseId} slot={s} eventId={eventId} />)}
                  </ol>
                </Card>
              )}
              {withoutTimes.length > 0 && (
                <Card variant="subtle">
                  <p className={styles.sub}>ללא שעות הופעה:</p>
                  <ul className={styles.plain}>
                    {withoutTimes.map((e) => (
                      <li key={e.id}><Link to={`/events/${eventId}/expenses/${e.id}`} className={styles.plainLink}><bdi>{e.artistName ?? e.name}</bdi></Link></li>
                    ))}
                  </ul>
                </Card>
              )}
            </Stack>
          )}
    </Section>
  );
}
