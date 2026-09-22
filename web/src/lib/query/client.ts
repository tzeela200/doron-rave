import { QueryClient } from '@tanstack/react-query';

// networkMode 'always' on purpose (ADR-046, Book 08 §24): TanStack's default ('online') pauses
// mutations while offline and replays them when the connection returns — that would be a
// silent offline write queue for money. With 'always' an offline save fails at once, the form
// keeps its values and the user decides to retry.
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        networkMode: 'always',
        staleTime: 30_000,
        gcTime: 10 * 60_000,
        retry: 1,
        refetchOnWindowFocus: true,
      },
      mutations: {
        networkMode: 'always',
        retry: 0,
      },
    },
  });
}
