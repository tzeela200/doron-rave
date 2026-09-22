import { supabase } from '@/lib/supabase/client';
import { AppError, toAppError } from '@/lib/errors';

// Minimal auth for two people (Book 08 §9). No sign-up, no roles, no profile screens.

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.status === 400 || /invalid/i.test(error.message)) {
      throw new AppError('AUTH', 'invalid_credentials', 'הדוא״ל או הסיסמה אינם נכונים.', 'signIn');
    }
    throw toAppError(error, 'signIn', 'לא הצלחנו להתחבר. נסה שוב.');
  }
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function getSessionEmail(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.email ?? null;
}

export function onAuthChange(callback: (signedIn: boolean, email: string | null, signedOutNow: boolean) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((event, session) =>
    callback(!!session, session?.user.email ?? null, event === 'SIGNED_OUT'));
  return () => data.subscription.unsubscribe();
}
