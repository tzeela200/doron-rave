import { lazy, Suspense } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { LoadingBlock } from '@/design-system/feedback';
import { useAuth } from './AuthProvider';

// The sign-in form (and its form/validation libraries) loads only when someone is signed out.
const LoginPage = lazy(() => import('./LoginPage').then((m) => ({ default: m.LoginPage })));

/** /login: shows the form when signed out, and returns to where the user was once signed in. */
export function LoginGate() {
  const { status } = useAuth();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  if (status === 'loading') return <LoadingBlock rows={2} />;
  if (status === 'signedIn') return <Navigate to={from} replace />;
  return <Suspense fallback={<LoadingBlock rows={2} />}><LoginPage /></Suspense>;
}
