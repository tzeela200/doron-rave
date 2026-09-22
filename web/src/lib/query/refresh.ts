import type { QueryKey } from '@tanstack/react-query';
import { qk } from './keys';

// Refresh Matrix (Book 07 §41, Book 10 §28): what each mutation must refresh — and nothing
// else. Prefix keys cover their children (e.g. qk.events.all covers every list filter).

const eventMoney = (eventId: string): QueryKey[] => [
  qk.event.detail(eventId),
  qk.event.financial(eventId),
  qk.events.all,
  qk.home,
];

export const refresh = {
  event: (eventId: string): QueryKey[] => [...eventMoney(eventId), qk.archive('events')],

  expense: (eventId: string, expenseId?: string): QueryKey[] => [
    ...eventMoney(eventId),
    qk.event.expenses(eventId),
    qk.event.readiness(eventId),
    qk.event.breakdown(eventId),
    qk.upcomingPayments,
    qk.artists.all,
    qk.vendors.all,
    ...(expenseId ? [qk.expense.root(expenseId)] : []),
  ],

  payment: (eventId: string, expenseId: string): QueryKey[] => [
    ...eventMoney(eventId),
    qk.event.expenses(eventId),
    qk.event.readiness(eventId), // "paid > 0" closes a readiness item (Book 04 §9)
    qk.expense.root(expenseId),
    qk.upcomingPayments,
  ],

  income: (eventId: string): QueryKey[] => [...eventMoney(eventId), qk.event.income(eventId)],

  tiers: (eventId: string): QueryKey[] => [...eventMoney(eventId), qk.event.tiers(eventId)],

  /** required items change readiness only — never money (Book 07 §41). */
  requiredItems: (eventId: string): QueryKey[] => [qk.event.readiness(eventId)],

  notes: (entityType: string, entityId: string): QueryKey[] => [qk.notes(entityType, entityId)],

  artist: (): QueryKey[] => [qk.artists.all],
  vendor: (): QueryKey[] => [qk.vendors.all],
  categories: (): QueryKey[] => [qk.categories],
  paymentMethods: (): QueryKey[] => [qk.paymentMethods],
  clone: (): QueryKey[] => [qk.events.all, qk.home],
};
