import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from 'react';
import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { LoadingBlock } from '@/design-system/feedback';
import { PageContainer } from '@/design-system/layout';
import { LoginGate } from '@/features/auth/LoginGate';
import { AppLayout } from './AppLayout';
import { RouteError } from './RouteError';

// Route map (Book 08 §21, Book 05 §27). Every entity screen is deep-linkable; short
// create/edit sub-flows open as bottom sheets inside their parent screen.

function page(Component: LazyExoticComponent<ComponentType>) {
  return (
    <Suspense fallback={<PageContainer><LoadingBlock rows={4} /></PageContainer>}>
      <Component />
    </Suspense>
  );
}

const named = <K extends string>(loader: () => Promise<Record<K, ComponentType>>, key: K) =>
  lazy(() => loader().then((m) => ({ default: m[key] })));

const HomePage = named(() => import('@/features/home/HomePage'), 'HomePage');
const EventsListPage = named(() => import('@/features/events/EventsListPage'), 'EventsListPage');
const EventFormPage = named(() => import('@/features/events/EventFormPage'), 'EventFormPage');
const EventDetailsPage = named(() => import('@/features/events/EventDetailsPage'), 'EventDetailsPage');
const EventClonePage = named(() => import('@/features/events/EventClonePage'), 'EventClonePage');
const ExpenseFormPage = named(() => import('@/features/expenses/ExpenseFormPage'), 'ExpenseFormPage');
const ArtistsPage = named(() => import('@/features/artists/ArtistsPage'), 'ArtistsPage');
const ArtistDetailPage = named(() => import('@/features/artists/ArtistDetailPage'), 'ArtistDetailPage');
const VendorsPage = named(() => import('@/features/vendors/VendorsPage'), 'VendorsPage');
const VendorDetailPage = named(() => import('@/features/vendors/VendorDetailPage'), 'VendorDetailPage');
const CategoriesPage = named(() => import('@/features/categories/CategoriesPage'), 'CategoriesPage');
const ComparePage = named(() => import('@/features/reports/ComparePage'), 'ComparePage');
const ManagementPage = named(() => import('@/features/management/ManagementPage'), 'ManagementPage');
const PaymentMethodsPage = named(() => import('@/features/payments/PaymentMethodsPage'), 'PaymentMethodsPage');
const UpcomingPaymentsPage = named(() => import('@/features/payments/UpcomingPaymentsPage'), 'UpcomingPaymentsPage');
const ArchivePage = named(() => import('@/features/management/ArchivePage'), 'ArchivePage');

/** Screen routes (also reused by the dev-only visual QA harness). */
export const screenRoutes: RouteObject[] = [
  { index: true, element: page(HomePage) },
  { path: 'events', element: page(EventsListPage) },
  { path: 'events/new', element: page(EventFormPage) },
  { path: 'events/:eventId', element: page(EventDetailsPage) },
  { path: 'events/:eventId/edit', element: page(EventFormPage) },
  { path: 'events/:eventId/clone', element: page(EventClonePage) },
  { path: 'events/:eventId/expenses/new', element: page(ExpenseFormPage) },
  { path: 'events/:eventId/expenses/:expenseId', element: page(ExpenseFormPage) },
  { path: 'artists', element: page(ArtistsPage) },
  { path: 'artists/:artistId', element: page(ArtistDetailPage) },
  { path: 'vendors', element: page(VendorsPage) },
  { path: 'vendors/:vendorId', element: page(VendorDetailPage) },
  { path: 'categories', element: page(CategoriesPage) },
  { path: 'compare', element: page(ComparePage) },
  { path: 'payments', element: page(UpcomingPaymentsPage) },
  { path: 'management', element: page(ManagementPage) },
  { path: 'management/payment-methods', element: page(PaymentMethodsPage) },
  { path: 'management/archive', element: page(ArchivePage) },
  { path: '*', element: <Navigate to="/" replace /> },
];

export const router = createBrowserRouter([
  { path: '/login', element: <LoginGate /> },
  { element: <AppLayout />, errorElement: <RouteError />, children: screenRoutes },
]);
