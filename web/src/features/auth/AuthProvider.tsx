import { useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getSessionEmail, onAuthChange, signOut } from './data/authRepository';

interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn';
  email: string | null;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthState['status']>('loading');
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getSessionEmail().then((e) => {
      if (!alive) return;
      setEmail(e);
      setStatus(e ? 'signedIn' : 'signedOut');
    });
    const unsubscribe = onAuthChange((signedIn, e, signedOutNow) => {
      setEmail(e);
      setStatus(signedIn ? 'signedIn' : 'signedOut');
      // A session that just ended (sign-out or expiry): drop cached business data from memory.
      if (signedOutNow) queryClient.clear();
    });
    return () => {
      alive = false;
      unsubscribe();
    };
  }, [queryClient]);

  const value = useMemo<AuthState>(() => ({ status, email, signOut }), [status, email]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth outside AuthProvider');
  return ctx;
}
