import { Archive, CalendarDays, CircleDollarSign, CreditCard, FolderTree, GitCompareArrows, LogOut, Mic2, Truck } from 'lucide-react';
import { AppHeader, QuickAction } from '@/components/navigation/navigation';
import { Button } from '@/design-system/Button';
import { Card } from '@/design-system/Card';
import { PageContainer, Section, Stack } from '@/design-system/layout';
import { Caption } from '@/design-system/Typography';
import { useAuth } from '@/features/auth/AuthProvider';
import styles from './ManagementPage.module.css';

// MANAGEMENT (Book 05 §19). Useful management entries — not an enterprise settings screen.

export function ManagementPage() {
  const { email, signOut } = useAuth();
  return (
    <>
      <AppHeader title="ניהול" />
      <PageContainer>
        <Section title="ישויות">
          <div className={styles.grid}>
            <QuickAction to="/artists" label="אמנים" icon={Mic2} />
            <QuickAction to="/categories" label="קטגוריות" icon={FolderTree} />
            <QuickAction to="/vendors" label="ספקים" icon={Truck} />
            <QuickAction to="/events" label="אירועים" icon={CalendarDays} />
          </div>
        </Section>
        <Section title="כספים ודוחות">
          <div className={styles.grid}>
            <QuickAction to="/payments" label="תשלומים" icon={CircleDollarSign} />
            <QuickAction to="/management/payment-methods" label="אמצעי תשלום" icon={CreditCard} />
            <QuickAction to="/compare" label="השוואת אירועים" icon={GitCompareArrows} />
            <QuickAction to="/management/archive" label="ארכיון" icon={Archive} />
          </div>
        </Section>
        <Section title="חשבון">
          <Card>
            <Stack gap="1-5">
              {email && <Caption><bdi>{email}</bdi></Caption>}
              <Button variant="secondary" icon={LogOut} onClick={() => void signOut()}>יציאה</Button>
            </Stack>
          </Card>
        </Section>
      </PageContainer>
    </>
  );
}
