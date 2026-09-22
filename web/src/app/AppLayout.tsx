import { useEffect, useState } from 'react';
import { Navigate, Outlet, ScrollRestoration, useLocation } from 'react-router-dom';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { BottomNavigation } from '@/components/navigation/navigation';
import { Button } from '@/design-system/Button';
import { InlineMessage, LoadingBlock } from '@/design-system/feedback';
import { useAuth } from '@/features/auth/AuthProvider';
import styles from './AppLayout.module.css';

/** Online-first notice (Book 05 §21). Data already on screen stays; nothing pretends to save. */
function OfflineNotice() {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);
  if (online) return null;
  return (
    <div className={styles.banner}>
      <InlineMessage tone="warning" title="אין כרגע חיבור. בדוק את החיבור ונסה שוב." />
    </div>
  );
}

/** A new service worker waits for the user; the app never reloads under a dirty form (Book 08 §24). */
function UpdatePrompt() {
  const { needRefresh: [needRefresh], updateServiceWorker } = useRegisterSW();
  if (!needRefresh) return null;
  return (
    <div className={styles.banner}>
      <InlineMessage
        tone="info"
        title="גרסה חדשה של האפליקציה מוכנה"
        action={<Button compact variant="secondary" onClick={() => void updateServiceWorker(true)}>רענן</Button>}
      />
    </div>
  );
}

export function AppLayout() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <div className={styles.boot}><LoadingBlock rows={3} /></div>;
  if (status === 'signedOut') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return (
    <div className={styles.shell}>
      <a href="#main" className={styles.skip}>דלג לתוכן</a>
      <OfflineNotice />
      <UpdatePrompt />
      <main id="main" className={styles.main}>
        <Outlet />
      </main>
      <BottomNavigation />
      <ScrollRestoration />
    </div>
  );
}
