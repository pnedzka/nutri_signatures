import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { APP_ID, supabase } from './supabase';

type Status = 'loading' | 'unconfigured' | 'signedOut' | 'noAccess' | 'signedIn' | 'error';

interface AuthState {
  status: Status;
  email: string | null;
  error: string | null;
  init: () => () => void;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

// Sign-in only, with the shared Nutri Partners account. Administrators and people with "signatures" in
// `profiles.apps` may use the generator; accounts and access are managed in the Nutri Partners hub.
export const useAuth = create<AuthState>((set) => {
  async function check(session: Session | null) {
    if (!session) {
      set({ status: 'signedOut', email: null });
      return;
    }
    const email = (session.user.email ?? '').toLowerCase();
    // Row level security returns only the user's own row.
    const { data, error } = await supabase!.from('profiles').select('role, apps').eq('id', session.user.id).maybeSingle();
    if (error) {
      set({ status: 'error', email, error: `Nie udało się sprawdzić uprawnień: ${error.message}` });
      return;
    }
    const apps = Array.isArray(data?.apps) ? (data.apps as string[]) : [];
    set({ status: data?.role === 'admin' || apps.includes(APP_ID) ? 'signedIn' : 'noAccess', email, error: null });
  }

  return {
    status: 'loading',
    email: null,
    error: null,
    init: () => {
      if (!supabase) {
        set({ status: 'unconfigured' });
        return () => {};
      }
      const { data } = supabase.auth.onAuthStateChange((event, session) => {
        // Token refreshes keep the same person: no need to check again.
        if (event === 'TOKEN_REFRESHED') return;
        // Supabase recommends not awaiting inside the callback.
        setTimeout(() => void check(session), 0);
      });
      return () => data.subscription.unsubscribe();
    },
    signIn: async (email, password) => {
      if (!supabase) throw new Error('Aplikacja nie jest skonfigurowana.');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Nieprawidłowy e-mail lub hasło.' : error.message);
    },
    signOut: async () => {
      await supabase?.auth.signOut();
      set({ status: 'signedOut', email: null });
    },
  };
});
