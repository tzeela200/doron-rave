import { ChevronRight, Phone, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/navigation/navigation';
import { Button, FloatingCreateButton } from '@/design-system/Button';
import { Card } from '@/design-system/Card';
import { EmptyState, ErrorState, LoadingBlock, NoResultsState } from '@/design-system/feedback';
import { SearchInput } from '@/design-system/form';
import { Icon } from '@/design-system/Icon';
import { PageContainer, Stack } from '@/design-system/layout';
import { Caption, Money } from '@/design-system/Typography';
import { useArtists } from '@/features/queries';
import { formatNumber } from '@/lib/format';
import { ArtistSheet } from './components/ArtistSheet';
import type { ArtistVM } from './data/artistsRepository';
import styles from './ArtistsPage.module.css';

// ARTISTS_LIST (Book 05 §12.1, Book 06 §35). Display name = stage || legacy || real; the real
// name is secondary when different. Counts/totals only from existing expenses.

export function ArtistCard({ artist }: { artist: ArtistVM }) {
  return (
    <li className={styles.item}>
      <Link to={`/artists/${artist.id}`} className={styles.row}>
        <div className={styles.main}>
          <p className={styles.name}><bdi>{artist.displayName}</bdi></p>
          {artist.realNameSecondary && <p className={styles.sub}><bdi>{artist.realNameSecondary}</bdi></p>}
          <p className={styles.sub}>
            {artist.eventsCount > 0 ? <>{formatNumber(artist.eventsCount)} אירועים · <Money value={artist.totalAgreed} /></> : 'עדיין לא שובץ באירוע'}
            {artist.phone && <span className={styles.phone}> · <Icon icon={Phone} size="xs" /><span dir="ltr" className="num">{artist.phone}</span></span>}
          </p>
        </div>
        <Icon icon={ChevronRight} size="sm" directional className={styles.chevron} />
      </Link>
    </li>
  );
}

export function ArtistsPage() {
  const artists = useArtists();
  const [params, setParams] = useSearchParams();
  const query = params.get('q') ?? '';
  const [adding, setAdding] = useState(false);
  const setQuery = (q: string) => setParams(q ? { q } : {}, { replace: true });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = artists.data ?? [];
    if (!q) return all;
    return all.filter((a) => [a.displayName, a.realName, a.legacyName ?? '', a.phone].some((f) => f.toLowerCase().includes(q)));
  }, [artists.data, query]);

  return (
    <>
      <AppHeader title="אמנים וליין־אפ" subtitle="הליין־אפ של כל אירוע נמצא בתוך האירוע" />
      <PageContainer>
        <Stack gap="1-5">
          <SearchInput label="חיפוש אמנים" placeholder="חיפוש אמנים…" value={query} onChange={setQuery} />
          {artists.data && <Caption>{formatNumber(visible.length)} אמנים</Caption>}
        </Stack>
        {artists.isLoading ? <LoadingBlock rows={4} height="72px" />
          : artists.error ? <ErrorState onRetry={() => void artists.refetch()} retrying={artists.isFetching} />
            : artists.data?.length === 0 ? <EmptyState title="אין עדיין אמנים" action={<Button variant="primary" icon={Plus} onClick={() => setAdding(true)}>הוסף אמן</Button>} />
              : visible.length === 0 ? <NoResultsState onClear={() => setQuery('')} clearLabel="נקה חיפוש" />
                : <Card padded={false}><ul>{visible.map((a) => <ArtistCard key={a.id} artist={a} />)}</ul></Card>}
      </PageContainer>
      <FloatingCreateButton icon={Plus} label="הוסף אמן" onClick={() => setAdding(true)} />
      {adding && <ArtistSheet artist={null} onClose={() => setAdding(false)} />}
    </>
  );
}
