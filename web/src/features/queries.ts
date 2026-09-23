import { useQuery } from '@tanstack/react-query';
import { buildReadiness, type ReadinessVM } from '@/domain/readiness';
import { EVENT_IMAGE_URL_TTL, type NoteEntityType } from '@/domain/constants';
import { qk } from '@/lib/query/keys';
import { getArtist, listArtists } from './artists/data/artistsRepository';
import { getCategoryTree, getCategoryUsage } from './categories/data/categoriesRepository';
import { eventImageUrl, getEventSummary, listEvents, listEventsByIds, type EventsFilter } from './events/data/eventsRepository';
import { getExpense, listEventExpenses, listExpensePayments, listUpcomingPayments } from './expenses/data/expensesRepository';
import { getHomeSummary } from './home/data/homeRepository';
import { listEventIncome } from './income/data/incomeRepository';
import { listNotes } from './notes/data/notesRepository';
import { listPaymentMethods } from './payments/data/paymentMethodsRepository';
import { listRequiredItems } from './readiness/data/readinessRepository';
import { getCategoryTotalsForEvents, getEventBreakdown } from './reports/data/reportsRepository';
import { getEntityExpenses, listVendors } from './vendors/data/vendorsRepository';

// Query hooks: the only way screens read server state (Book 08 §12). Keys are central (qk).
// Dictionaries change rarely → longer staleTime; money views use the default.

const DICTIONARY_STALE = 5 * 60_000;

export const useCategoryTree = () =>
  useQuery({ queryKey: qk.categories, queryFn: getCategoryTree, staleTime: DICTIONARY_STALE });
export const useCategoryUsage = () =>
  useQuery({ queryKey: [...qk.categories, 'usage'], queryFn: getCategoryUsage });
export const usePaymentMethods = () =>
  useQuery({ queryKey: qk.paymentMethods, queryFn: listPaymentMethods, staleTime: DICTIONARY_STALE });
export const useVendors = (includeArchived = false) =>
  useQuery({ queryKey: [...qk.vendors.list, includeArchived], queryFn: () => listVendors(includeArchived) });
export const useArtists = (includeArchived = false) =>
  useQuery({ queryKey: [...qk.artists.list, includeArchived], queryFn: () => listArtists(includeArchived) });
export const useArtist = (id: string) =>
  useQuery({ queryKey: qk.artists.detail(id), queryFn: () => getArtist(id) });
export const useEntityExpenses = (column: 'vendor_id' | 'artist_id', id: string) =>
  useQuery({
    queryKey: column === 'vendor_id' ? [...qk.vendors.detail(id), 'expenses'] : [...qk.artists.detail(id), 'expenses'],
    queryFn: () => getEntityExpenses(column, id),
  });

export const useEvents = (filter: EventsFilter) =>
  useQuery({ queryKey: qk.events.list(filter), queryFn: () => listEvents(filter) });
export const useEventsByIds = (ids: readonly string[]) =>
  useQuery({ queryKey: qk.events.compare(ids), queryFn: () => listEventsByIds(ids), enabled: ids.length > 0 });
export const useEventSummary = (eventId: string) =>
  useQuery({ queryKey: qk.event.financial(eventId), queryFn: () => getEventSummary(eventId) });
/** Signed URL for an event poster; refreshed well before the signature expires. */
export const useEventImageUrl = (path: string | null) =>
  useQuery({
    queryKey: qk.eventImage(path ?? ''),
    queryFn: () => eventImageUrl(path ?? ''),
    enabled: !!path,
    staleTime: (EVENT_IMAGE_URL_TTL - 300) * 1000,
    gcTime: EVENT_IMAGE_URL_TTL * 1000,
  });
export const useEventExpenses = (eventId: string) =>
  useQuery({ queryKey: qk.event.expenses(eventId), queryFn: () => listEventExpenses(eventId) });
export const useExpense = (expenseId: string | undefined) =>
  useQuery({ queryKey: qk.expense.detail(expenseId ?? ''), queryFn: () => getExpense(expenseId ?? ''), enabled: !!expenseId });
export const useExpensePayments = (expenseId: string | undefined) =>
  useQuery({ queryKey: qk.expense.payments(expenseId ?? ''), queryFn: () => listExpensePayments(expenseId ?? ''), enabled: !!expenseId });
export const useEventIncome = (eventId: string) =>
  useQuery({ queryKey: qk.event.income(eventId), queryFn: () => listEventIncome(eventId) });
export const useBreakdown = (eventId: string) =>
  useQuery({ queryKey: qk.event.breakdown(eventId), queryFn: () => getEventBreakdown(eventId) });
export const useCategoryTotalsForEvents = (ids: readonly string[]) =>
  useQuery({ queryKey: [...qk.events.compare(ids), 'categories'], queryFn: () => getCategoryTotalsForEvents(ids), enabled: ids.length > 0 });
export const useUpcomingPayments = (limit?: number) =>
  useQuery({ queryKey: [...qk.upcomingPayments, limit ?? 'all'], queryFn: () => listUpcomingPayments(limit) });
export const useHomeSummary = () => useQuery({ queryKey: [...qk.home, 'summary'], queryFn: getHomeSummary });
export const useNotes = (entityType: NoteEntityType, entityId: string) =>
  useQuery({ queryKey: qk.notes(entityType, entityId), queryFn: () => listNotes(entityType, entityId) });
export const useRequiredItems = (eventId: string) =>
  useQuery({ queryKey: qk.event.readiness(eventId), queryFn: () => listRequiredItems(eventId) });

/**
 * Readiness view-model: the user's required items + the event's expenses/coverage, through the
 * single domain function (Book 04 §9). Not a separate query — derived from cached data.
 */
export function useReadiness(eventId: string): { data: ReadinessVM | undefined; isLoading: boolean; error: unknown; refetch: () => void } {
  const required = useRequiredItems(eventId);
  const expenses = useEventExpenses(eventId);
  const tree = useCategoryTree();
  const loading = required.isLoading || expenses.isLoading || tree.isLoading;
  const error = required.error ?? expenses.error ?? tree.error;
  let data: ReadinessVM | undefined;
  if (required.data && expenses.data && tree.data) {
    const t = tree.data;
    const expenseName = new Map(expenses.data.map((e) => [e.id, e.name]));
    data = buildReadiness(
      required.data,
      expenses.data.map((e) => ({
        id: e.id, name: e.name, categoryId: e.categoryId, subcategoryId: e.subcategoryId,
        agreedAmount: e.agreedAmount, manualStatus: e.manualStatus, paidAmount: e.paidAmount,
      })),
      expenses.data.flatMap((e) => e.coverage.map((c) => ({
        expenseId: e.id, expenseName: expenseName.get(e.id) ?? '', categoryId: c.categoryId, subcategoryId: c.subcategoryId, customLabel: c.customLabel,
      }))),
      {
        categoryName: (id) => t.categoryById.get(id)?.name,
        subcategoryName: (id) => t.subcategoryById.get(id)?.name,
        subcategoryParentName: (id) => {
          const sub = t.subcategoryById.get(id);
          return sub ? t.categoryById.get(sub.categoryId)?.name : undefined;
        },
      },
    );
  }
  return {
    data,
    isLoading: loading,
    error,
    refetch: () => { void required.refetch(); void expenses.refetch(); void tree.refetch(); },
  };
}
