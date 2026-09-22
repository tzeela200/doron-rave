import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { router } from '@/app/router';
import { ToastProvider } from '@/design-system/feedback';
import { AuthProvider } from '@/features/auth/AuthProvider';
import { createQueryClient } from '@/lib/query/client';
import '@/design-system/globals.css';

// Bootstrap (Book 08 §6): one Supabase client (module), one QueryClient, router, toasts.
// Nothing fetches the whole database on mount — every route loads only what it shows.
const queryClient = createQueryClient();

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <AuthProvider>
          <RouterProvider router={router} />
        </AuthProvider>
      </ToastProvider>
    </QueryClientProvider>
  </StrictMode>,
);
