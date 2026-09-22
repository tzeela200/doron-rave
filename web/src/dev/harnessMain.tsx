// DEV-ONLY visual QA harness (Book 06 §53: "component harness/test route בפיתוח").
// Renders the REAL screens against a query cache seeded with labelled sample view-models, so
// layout, RTL and mobile widths can be checked without a signed-in session. Writes still go
// to the real API and fail without a session — which exercises the failure path (Book 10 J7).
// Served only by the Vite dev server (harness.html); the production build contains index.html only.

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router-dom';
import { screenRoutes } from '@/app/router';
import { BottomNavigation } from '@/components/navigation/navigation';
import { ToastProvider } from '@/design-system/feedback';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { qk } from '@/lib/query/keys';
import '@/design-system/globals.css';
import * as d from './harnessData';
import styles from '@/app/AppLayout.module.css';

const client = new QueryClient({
  defaultOptions: {
    queries: { staleTime: Infinity, retry: false, refetchOnWindowFocus: false, networkMode: 'always' },
    mutations: { networkMode: 'always', retry: 0 },
  },
});

const seed: [readonly unknown[], unknown][] = [
  [qk.categories, d.categoryTree],
  [[...qk.categories, 'usage'], new Map([['c-art', 2], ['c-tech', 1], ['c-site', 1]])],
  [qk.paymentMethods, d.methods],
  [[...qk.vendors.list, false], d.vendors],
  [[...qk.vendors.list, true], d.vendors],
  [[...qk.artists.list, false], d.artists],
  [[...qk.artists.list, true], d.artists],
  [qk.artists.detail('a1'), d.artists[0]],
  [[...qk.artists.detail('a1'), 'expenses'], []],
  [[...qk.vendors.detail('v1'), 'expenses'], []],
  [qk.events.list('upcoming'), d.events],
  [qk.events.list('active'), d.events],
  [qk.events.list('past'), []],
  [qk.events.list('archive'), []],
  [[...qk.upcomingPayments, 5], d.upcoming],
  [[...qk.upcomingPayments, 'all'], d.upcoming],
  [[...qk.home, 'summary'], d.home],
  [qk.notes('artist', 'a1'), []],
  [qk.expense.detail(d.HARNESS_EXPENSE_ID), d.expenses[0]],
  [qk.expense.payments(d.HARNESS_EXPENSE_ID), d.payments],
];
for (const e of d.events) {
  const mine = e.id === d.HARNESS_EVENT_ID;
  seed.push(
    [qk.event.financial(e.id), e],
    [qk.event.expenses(e.id), mine ? d.expenses : []],
    [qk.event.income(e.id), mine ? d.income : []],
    [qk.event.readiness(e.id), mine ? d.requiredItems : []],
    [qk.event.breakdown(e.id), mine ? d.breakdown : { byCategory: [], byVendor: [] }],
    [qk.notes('event', e.id), mine ? d.notes : []],
  );
}
for (const [key, value] of seed) client.setQueryData(key, value);

function HarnessLayout() {
  return (
    <div className={styles.shell}>
      <p role="note" style={{ margin: 0, padding: 'var(--space-1) var(--page-gutter)', background: 'var(--color-warning-soft)', fontSize: 'var(--font-size-label)' }}>
        תצוגת בדיקה בלבד — נתוני דוגמה, לא נתונים אמיתיים
      </p>
      <main className={styles.main}><Outlet /></main>
      <BottomNavigation />
    </div>
  );
}

const path = new URLSearchParams(window.location.search).get('path') ?? '/';
const router = createMemoryRouter([{ element: <HarnessLayout />, children: screenRoutes }], { initialEntries: [path] });

const root = document.getElementById('root');
if (root) {
  createRoot(root).render(
    <StrictMode>
      <QueryClientProvider client={client}>
        <ToastProvider>
          <AuthProvider>
            <RouterProvider router={router} />
          </AuthProvider>
        </ToastProvider>
      </QueryClientProvider>
    </StrictMode>,
  );
}
