import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/design-system/Button';
import { Field, Input } from '@/design-system/form';
import { InlineMessage } from '@/design-system/feedback';
import { Stack } from '@/design-system/layout';
import { Body } from '@/design-system/Typography';
import { userMessage } from '@/lib/errors';
import { signIn } from './data/authRepository';
import styles from './LoginPage.module.css';

const schema = z.object({
  email: z.string().trim().min(1, 'יש להזין דוא״ל').email('יש להזין דוא״ל תקין'),
  password: z.string().min(1, 'יש להזין סיסמה'),
});
type Values = z.infer<typeof schema>;

/** The only unauthenticated screen. Accounts are created by the owner in Supabase, not here. */
export function LoginPage() {
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema), defaultValues: { email: '', password: '' } });

  const onSubmit = handleSubmit(async (values) => {
    setError(null);
    try {
      await signIn(values.email, values.password);
    } catch (e) {
      setError(userMessage(e, 'לא הצלחנו להתחבר. נסה שוב.'));
    }
  });

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <img src="/icons/icon-192.png" alt="" className={styles.logo} width={72} height={72} />
        <h1 className={styles.title}>DORON&apos;S RAVE</h1>
        <Body compact className={styles.subtitle}>כניסה למערכת</Body>
        <form onSubmit={onSubmit} noValidate>
          <Stack gap="2">
            {error && <InlineMessage tone="error" title={error} />}
            <Field label="דוא״ל" error={formState.errors.email?.message} required>
              {(a11y) => <Input {...a11y} {...register('email')} type="email" inputMode="email" autoComplete="username" dir="ltr" />}
            </Field>
            <Field label="סיסמה" error={formState.errors.password?.message} required>
              {(a11y) => <Input {...a11y} {...register('password')} type="password" autoComplete="current-password" dir="ltr" />}
            </Field>
            <Button type="submit" variant="primary" fullWidth loading={formState.isSubmitting} loadingText="מתחבר…">כניסה</Button>
          </Stack>
        </form>
      </div>
    </main>
  );
}
