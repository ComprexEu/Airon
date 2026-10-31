import { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

type AuthState = { session: Session | null; loading: boolean };

const AuthContext = createContext<AuthState>({ session: null, loading: true });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. On start: is there a saved session on the phone?
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // 2. Listen for changes: sign in, sign out, token refresh
    const { data } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    // 3. Clean up when the component unmounts
    return () => data.subscription.unsubscribe();
  }, []);

  return <AuthContext.Provider value={{ session, loading }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
