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
import { useEntityExpenses, useVendors } from '@/features/queries';
import { formatDate, formatNumber } from '@/lib/format';
import { refresh } from '@/lib/query/refresh';
import { useAppMutation } from '@/lib/query/useAppMutation';
import { archiveVendor } from './data/vendorsRepository';
import { VendorSheet } from './VendorsPage';
import styles from '@/features/artists/ArtistsPage.module.css';

// Vendor details + expense history (Book 05 §13). Archive never removes past expenses.

export function VendorDetailPage() {
  const { vendorId = '' } = useParams();
  const navigate = useNavigate();
  const vendors = useVendors(true);
  const history = useEntityExpenses('vendor_id', vendorId);
  const [editing, setEditing] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const archive = useAppMutation({
    operation: 'archiveVendor',
    mutationFn: archiveVendor,
    refresh: () => refresh.vendor(),
    successMessage: 'הפריט הועבר לארכיון',
    onSuccess: () => navigate('/vendors', { replace: true }),
  });

  if (vendors.isLoading) return <><AppHeader title="ספק" back="/vendors" /><PageContainer><LoadingBlock rows={3} /></PageContainer></>;
  const v = vendors.data?.find((x) => x.id === vendorId);
  if (vendors.error || !v) {
    return <><AppHeader title="ספק" back="/vendors" /><PageContainer><ErrorState message={vendors.error ? 'לא הצלחנו לטעון את הנתונים. נסה שוב.' : 'הפריט לא נמצא או שאינו זמין יותר.'} onRetry={() => void vendors.refetch()} /></PageContainer></>;
  }

  return (
    <>
      <AppHeader
        title={v.name}
        back="/vendors"
        action={!v.isArchived ? <Button variant="secondary" compact icon={Pencil} onClick={() => setEditing(true)}>ערוך</Button> : undefined}
      />
      <PageContainer>
        {v.isArchived && <Badge>בארכיון</Badge>}
        <Card>
          <dl className={styles.dl}>
            {v.phone && <div className={styles.dlRow}><dt>טלפון</dt><dd><a href={`tel:${v.phone}`} className={`${styles.tel} num`} dir="ltr">{v.phone}</a></dd></div>}
            {v.contactDetails && <div className={styles.dlRow}><dt>פרטי קשר</dt><dd>{v.contactDetails}</dd></div>}
            {v.notes && <div className={styles.dlRow}><dt>הערות</dt><dd>{v.notes}</dd></div>}
            <div className={styles.dlRow}><dt>אירועים</dt><dd className="num">{formatNumber(v.eventsCount)} · <Money value={v.totalAgreed} /></dd></div>
            {v.nextEvent && (
              <div className={styles.dlRow}>
                <dt>האירוע הקרוב</dt>
                <dd><Link to={`/events/${v.nextEvent.id}`} className={styles.tel}><bdi>{v.nextEvent.name}</bdi>&nbsp;·&nbsp;<span className="num">{formatDate(v.nextEvent.date)}</span></Link></dd>
              </div>
            )}
          </dl>
        </Card>
        <Section title="היסטוריית הוצאות">
          {history.isLoading ? <LoadingBlock rows={2} height="64px" />
            : history.error ? <ErrorState onRetry={() => void history.refetch()} />
              : history.data?.length === 0 ? <EmptyState compact title="אין הוצאות מקושרות לספק הזה" />
                : (
                  <Card padded={false}>
                    <ul>
                      {history.data?.map((h) => (
                        <li key={h.expenseId} className={styles.item}>
                          <Link to={`/events/${h.eventId}/expenses/${h.expenseId}`} className={styles.row}>
                            <div className={styles.main}>
                              <p className={styles.name}><bdi>{h.expenseName}</bdi></p>
                              <p className={styles.sub}><bdi>{h.eventName}</bdi> · <span className="num">{formatDate(h.eventDate)}</span></p>
                            </div>
                            <Money value={h.agreedAmount} />
                            <Icon icon={ChevronRight} size="sm" directional className={styles.chevron} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </Card>
                )}
        </Section>
        {!v.isArchived && <Button variant="ghost" icon={Archive} onClick={() => setArchiveOpen(true)}>העבר לארכיון</Button>}
      </PageContainer>
      {editing && <VendorSheet vendor={v} onClose={() => setEditing(false)} />}
      <ConfirmArchive
        open={archiveOpen}
        title="להעביר את הספק לארכיון?"
        body="הספק לא יופיע בבחירות פעילות. ההוצאות הקודמות שלו נשמרות."
        loading={archive.isPending}
        error={archive.error?.userMessage}
        onConfirm={() => archive.mutate(v.id)}
        onCancel={() => { setArchiveOpen(false); archive.reset(); }}
      />
    </>
  );
}
