import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AppHeader } from '@/components/navigation/navigation';
import { Card } from '@/design-system/Card';
import { EmptyState, ErrorState, LoadingBlock } from '@/design-system/feedback';
import { PageContainer } from '@/design-system/layout';
import { SegmentedControl } from '@/design-system/patterns';
import { Caption } from '@/design-system/Typography';
import { useArtists, useCategoryTree, useEvents, useVendors } from '@/features/queries';
import { formatDate } from '@/lib/format';
import styles from './ManagementPage.module.css';

// ARCHIVE_VIEWS (Book 05 §27, Book 07 F26). Read-only history: archived rows stay intact and out
// of every active list and calculation. No restore/delete here — the books define none.

type Entity = 'events' | 'artists' | 'vendors' | 'categories';

export function ArchivePage() {
  const [entity, setEntity] = useState<Entity>('events');
  const events = useEvents('archive');
  const artists = useArtists(true);
  const vendors = useVendors(true);
  const tree = useCategoryTree();

  const q = { events, artists, vendors, categories: tree }[entity];
  let rows: { id: string; name: string; sub?: string; to?: string }[] = [];
  if (entity === 'events') rows = (events.data ?? []).map((e) => ({ id: e.id, name: e.name, sub: formatDate(e.eventDate) ?? '', to: `/events/${e.id}` }));
  if (entity === 'artists') rows = (artists.data ?? []).filter((a) => a.isArchived).map((a) => ({ id: a.id, name: a.displayName, to: `/artists/${a.id}` }));
  if (entity === 'vendors') rows = (vendors.data ?? []).filter((v) => v.isArchived).map((v) => ({ id: v.id, name: v.name, to: `/vendors/${v.id}` }));
  if (entity === 'categories') {
    rows = (tree.data?.categories ?? []).flatMap((c) => [
      ...(c.isArchived ? [{ id: c.id, name: c.name, sub: 'קטגוריה' }] : []),
      ...c.subcategories.filter((s) => s.isArchived).map((s) => ({ id: s.id, name: s.name, sub: `תת־קטגוריה של ${c.name}` })),
    ]);
  }

  return (
    <>
      <AppHeader title="ארכיון" back="/management" />
      <PageContainer>
        <SegmentedControl label="סוג" value={entity} onChange={setEntity}
          options={[{ value: 'events', label: 'אירועים' }, { value: 'artists', label: 'אמנים' }, { value: 'vendors', label: 'ספקים' }, { value: 'categories', label: 'קטגוריות' }]} />
        <Caption>פריטים בארכיון אינם נספרים בחישובים הפעילים. ההיסטוריה שלהם נשמרת.</Caption>
        {q.isLoading ? <LoadingBlock rows={3} height="56px" />
          : q.error ? <ErrorState onRetry={() => void q.refetch()} />
            : rows.length === 0 ? <EmptyState compact title="אין פריטים בארכיון" />
              : (
                <Card padded={false}>
                  <ul className={styles.list}>
                    {rows.map((r) => (
                      <li key={r.id} className={styles.row}>
                        {r.to ? (
                          <Link to={r.to} className={styles.link}><bdi>{r.name}</bdi>{r.sub && <span className={styles.sub}>{r.sub}</span>}</Link>
                        ) : (
                          <span className={styles.link}><bdi>{r.name}</bdi>{r.sub && <span className={styles.sub}>{r.sub}</span>}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </Card>
              )}
      </PageContainer>
    </>
  );
}
