// Central query keys (Book 08 §12). Every screen and every invalidation uses these —
// no string keys scattered in components.

export const qk = {
  events: {
    all: ['events'] as const,
    list: (filter: string) => ['events', 'list', filter] as const,
    compare: (ids: readonly string[]) => ['events', 'compare', [...ids].sort().join(',')] as const,
  },
  home: ['home'] as const,
  event: {
    root: (eventId: string) => ['event', eventId] as const,
    detail: (eventId: string) => ['event', eventId, 'detail'] as const,
    financial: (eventId: string) => ['event', eventId, 'financial'] as const,
    expenses: (eventId: string) => ['event', eventId, 'expenses'] as const,
    income: (eventId: string) => ['event', eventId, 'income'] as const,
    tiers: (eventId: string) => ['event', eventId, 'tiers'] as const,
    readiness: (eventId: string) => ['event', eventId, 'readiness'] as const,
    breakdown: (eventId: string) => ['event', eventId, 'breakdown'] as const,
  },
  expense: {
    root: (expenseId: string) => ['expense', expenseId] as const,
    detail: (expenseId: string) => ['expense', expenseId, 'detail'] as const,
    payments: (expenseId: string) => ['expense', expenseId, 'payments'] as const,
  },
  eventImage: (path: string) => ['event-image', path] as const,
  upcomingPayments: ['upcoming-payments'] as const,
  notes: (entityType: string, entityId: string) => ['notes', entityType, entityId] as const,
  artists: {
    all: ['artists'] as const,
    list: ['artists', 'list'] as const,
    detail: (id: string) => ['artists', 'detail', id] as const,
  },
  vendors: {
    all: ['vendors'] as const,
    list: ['vendors', 'list'] as const,
    detail: (id: string) => ['vendors', 'detail', id] as const,
  },
  categories: ['categories'] as const,
  paymentMethods: ['payment-methods'] as const,
  archive: (entity: string) => ['archive', entity] as const,
};
