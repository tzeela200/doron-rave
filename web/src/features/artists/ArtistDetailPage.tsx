import { Archive, ChevronRight, Pencil } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '@/components/navigation/navigation';
import { Button } from '@/design-system/Button';
import { Badge, Card } from '@/design-system/Card';
import { EmptyState, ErrorState, LoadingBlock } from '@/design-system/feedback';
import { Icon } from '@/design-system/Icon';
import { PageContainer, Section } from '@/design-system/layout';
import { ConfirmArchive } from '@/design-system/patterns';
import { Money } from '@/design-system/Typography';
import { performanceDurationMinutes, toHHMM } from '@/domain/lineup';
import { NotesSection } from '@/features/notes/components/NotesSection';
import { useArtist, useEntityExpenses } from '@/features/queries';
import { userMessage } from '@/lib/errors';
import { formatDate, formatDuration, formatNumber } from '@/lib/format';
import { refresh } from '@/lib/query/refresh';
import { useAppMutation } from '@/lib/query/useAppMutation';
import { ArtistSheet } from './components/ArtistSheet';
import { archiveArtist } from './data/artistsRepository';
import styles from './ArtistsPage.module.css';

// ARTIST_DETAIL_EDIT (Book 05 §12.2). Details, event/expense history, dated notes.
// No reminders at artist level (Book 05 §12.2); archive keeps history (ADR-038).

export function ArtistDetailPage() {
  const { artistId = '' } = useParams();
  const navigate = useNavigate();
  const artist = useArtist(artistId);
  const history = useEntityExpenses('artist_id', artistId);
  const [editing, setEditing] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const archive = useAppMutation({
    operation: 'archiveArtist',
    mutationFn: archiveArtist,
    refresh: () => refresh.artist(),
    successMessage: 'הפריט הועבר לארכיון',
    onSuccess: () => navigate('/artists', { replace: true }),
  });

  if (artist.isLoading) return <><AppHeader title="אמן" back="/artists" /><PageContainer><LoadingBlock rows={3} /></PageContainer></>;
  if (artist.error || !artist.data) {
    return <><AppHeader title="אמן" back="/artists" /><PageContainer><ErrorState message={userMessage(artist.error, 'לא הצלחנו לטעון את הנתונים. נסה שוב.')} onRetry={() => void artist.refetch()} /></PageContainer></>;
  }
  const a = artist.data;

  return (
    <>
      <AppHeader
        title={a.displayName}
        back="/artists"
        subtitle={a.realNameSecondary ? <bdi>{a.realNameSecondary}</bdi> : undefined}
        action={!a.isArchived ? <Button variant="secondary" compact icon={Pencil} onClick={() => setEditing(true)}>ערוך</Button> : undefined}
      />
      <PageContainer>
        {a.isArchived && <Badge>בארכיון</Badge>}
        <Card>
          <dl className={styles.dl}>
            {a.stageName && <div className={styles.dlRow}><dt>שם במה</dt><dd><bdi>{a.stageName}</bdi></dd></div>}
            {a.realName && <div className={styles.dlRow}><dt>שם אמיתי</dt><dd><bdi>{a.realName}</bdi></dd></div>}
            {a.phone && <div className={styles.dlRow}><dt>טלפון</dt><dd><a href={`tel:${a.phone}`} className={`${styles.tel} num`} dir="ltr">{a.phone}</a></dd></div>}
            {a.contactDetails && <div className={styles.dlRow}><dt>פרטי קשר</dt><dd>{a.contactDetails}</dd></div>}
            {a.notes && <div className={styles.dlRow}><dt>הערות</dt><dd>{a.notes}</dd></div>}
            {a.systemNotes && <div className={styles.dlRow}><dt>הערות קבועות</dt><dd>{a.systemNotes}</dd></div>}
            <div className={styles.dlRow}><dt>אירועים</dt><dd className="num">{formatNumber(a.eventsCount)} · <Money value={a.totalAgreed} /></dd></div>
            {a.nextEvent && (
              <div className={styles.dlRow}>
                <dt>האירוע הקרוב</dt>
                <dd><Link to={`/events/${a.nextEvent.id}`} className={styles.tel}><bdi>{a.nextEvent.name}</bdi>&nbsp;·&nbsp;<span className="num">{formatDate(a.nextEvent.date)}</span></Link></dd>
              </div>
            )}
          </dl>
        </Card>

        <Section title="היסטוריית אירועים">
          {history.isLoading ? <LoadingBlock rows={2} height="64px" />
            : history.error ? <ErrorState onRetry={() => void history.refetch()} />
              : history.data?.length === 0 ? <EmptyState compact title="האמן עדיין לא שובץ באירוע" />
                : (
                  <Card padded={false}>
                    <ul>
                      {history.data?.map((h) => {
                        const d = performanceDurationMinutes(h.start, h.end);
                        return (
                          <li key={h.expenseId} className={styles.item}>
                            <Link to={`/events/${h.eventId}/expenses/${h.expenseId}`} className={styles.row}>
                              <div className={styles.main}>
                                <p className={styles.name}><bdi>{h.eventName}</bdi></p>
                                <p className={styles.sub}>
                                  <span className="num">{formatDate(h.eventDate)}</span>
                                  {d !== null && <> · <span className="num" dir="ltr">{toHHMM(h.start)}–{toHHMM(h.end)}</span> · {formatDuration(d)}</>}
                                </p>
                              </div>
                              <Money value={h.agreedAmount} />
                              <Icon icon={ChevronRight} size="sm" directional className={styles.chevron} />
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </Card>
                )}
        </Section>

        <NotesSection entityType="artist" entityId={a.id} allowReminders={false} />

        {!a.isArchived && <Button variant="danger" icon={Archive} onClick={() => setArchiveOpen(true)}>העבר לארכיון</Button>}
      </PageContainer>
      {editing && <ArtistSheet artist={a} onClose={() => setEditing(false)} />}
      <ConfirmArchive
        open={archiveOpen}
        title="להעביר את האמן לארכיון?"
        body="האמן לא יופיע בבחירות פעילות. ההיסטוריה שלו באירועים קודמים נשמרת."
        loading={archive.isPending}
        error={archive.error?.userMessage}
        onConfirm={() => archive.mutate(a.id)}
        onCancel={() => { setArchiveOpen(false); archive.reset(); }}
      />
    </>
  );
}
