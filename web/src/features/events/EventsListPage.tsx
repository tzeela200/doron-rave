import { GitCompareArrows, Plus } from 'lucide-react';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppHeader } from '@/components/navigation/navigation';
import { LinkButton } from '@/design-system/Button';
import { EmptyState, ErrorState, LoadingBlock, NoResultsState } from '@/design-system/feedback';
import { SearchInput } from '@/design-system/form';
import { Grid, Inline, PageContainer, Stack } from '@/design-system/layout';
import { SegmentedControl } from '@/design-system/patterns';
import { Caption } from '@/design-system/Typography';
import { useEvents } from '@/features/queries';
import { formatNumber } from '@/lib/format';
import { EventCard } from './components/EventCard';
import type { EventsFilter } from './data/eventsRepository';

// EVENTS_LIST (Book 05 §5). Query and filter live in the URL, so Back from an event restores
// them (Book 07 F27); scroll is restored by the router.

const FILTERS: { value: EventsFilter; label: string }[] = [
  { value: 'active', label: 'פעילים' },
  { value: 'upcoming', label: 'עתידיים' },
  { value: 'past', label: 'עבר' },
  { value: 'archive', label: 'ארכיון' },
];

export function EventsListPage() {
  const [params, setParams] = useSearchParams();
  const filter = (FILTERS.find((f) => f.value === params.get('filter'))?.value ?? 'active') as EventsFilter;
  const query = params.get('q') ?? '';
  const events = useEvents(filter);

  const update = (next: { filter?: EventsFilter; q?: string }) => {
    const p = new URLSearchParams(params);
    if (next.filter === 'active') p.delete('filter');
    else if (next.filter !== undefined) p.set('filter', next.filter);
    if (next.q === '') p.delete('q');
    else if (next.q !== undefined) p.set('q', next.q);
    setParams(p, { replace: true });
  };

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !events.data) return events.data ?? [];
    return events.data.filter((e) => e.name.toLowerCase().includes(q) || e.location.toLowerCase().includes(q));
  }, [events.data, query]);

  return (
    <>
      <AppHeader title="אירועים" action={<LinkButton to="/events/new" variant="primary" compact icon={Plus}>צור אירוע</LinkButton>} />
      <PageContainer>
        <Stack gap="1-5">
          <SearchInput label="חיפוש אירועים" placeholder="חיפוש אירועים…" value={query} onChange={(q) => update({ q })} />
          <SegmentedControl label="סינון אירועים" options={FILTERS} value={filter} onChange={(f) => update({ filter: f })} />
          <Inline justify="between">
            {events.data && <Caption>{formatNumber(visible.length)} אירועים</Caption>}
            <LinkButton to="/compare" variant="ghost" compact icon={GitCompareArrows}>השוואת אירועים</LinkButton>
          </Inline>
        </Stack>

        {events.isLoading ? <LoadingBlock rows={3} height="160px" />
          : events.error ? <ErrorState onRetry={() => void events.refetch()} retrying={events.isFetching} />
            : events.data && events.data.length === 0 ? (
              filter === 'archive'
                ? <EmptyState title="אין אירועים בארכיון" />
                : <EmptyState title="אין עדיין אירועים" action={<LinkButton to="/events/new" variant="primary" icon={Plus}>צור אירוע</LinkButton>} />
            ) : visible.length === 0 ? (
              <NoResultsState onClear={() => update({ q: '' })} clearLabel="נקה חיפוש" />
            ) : (
              <Grid columns={2} desktopColumns={3}>
                {visible.map((e) => <EventCard key={e.id} event={e} />)}
              </Grid>
            )}
      </PageContainer>
    </>
  );
}
