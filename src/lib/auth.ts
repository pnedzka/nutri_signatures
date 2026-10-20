import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { setMonitoringUser } from './monitoring';
import { signInViaHub, signOutOfHub, ssoDone, takeSsoToken } from './sso';
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

const SSO_FAILED = 'Automatyczne logowanie z aplikacji Nutri Partners nie zadziałało. Zaloguj się poniżej.';

// A one-time token from the hub (lib/sso.ts) becomes this app's session, exactly once: React StrictMode runs effects
// twice, and the token can be used only once.
const ssoToken = supabase ? takeSsoToken() : null;
async function signInWithHubToken(token: string): Promise<string | null> {
  const { error } = await supabase!.auth.verifyOtp({ token_hash: token, type: 'magiclink' });
  if (error) return SSO_FAILED;
  ssoDone();
  return null;
}
const ssoSignIn = ssoToken ? signInWithHubToken(ssoToken) : null;
/** Set while signing out here, so the app does not ask the hub to sign the person back in. */
let signingOut = false;

// Sign-in only, with the shared Nutri Partners account, once, in the hub (the form here is the fallback). Administrators and people with "signatures" in
// `profiles.apps` may use the generator; accounts and access are managed in the Nutri Partners hub.
export const useAuth = create<AuthState>((set) => {
  async function check(session: Session | null) {
    if (!session) {
      set({ status: 'signedOut', email: null });
      setMonitoringUser(null);
      return;
    }
    const email = (session.user.email ?? '').toLowerCase();
    setMonitoringUser({ id: session.user.id, email });
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
      const client = supabase;
      let unsubscribe: (() => void) | null = null;
      let stopped = false;
      const listen = (ssoError: string | null) => {
        if (stopped) return;
        if (ssoError) set({ error: ssoError });
        const { data } = client.auth.onAuthStateChange((event, session) => {
          // Token refreshes keep the same person: no need to check again.
          if (event === 'TOKEN_REFRESHED') return;
          // No session (on opening, or after it ended elsewhere): sign in through the hub, unless its token just
          // failed or that was tried a moment ago.
          if (!session && !ssoToken && !signingOut && signInViaHub()) return;
          // Supabase recommends not awaiting inside the callback.
          setTimeout(() => void check(session), 0);
        });
        unsubscribe = () => data.subscription.unsubscribe();
      };
      // Listen only once the hub's token is exchanged, so the first state seen is the new session.
      if (ssoSignIn) void ssoSignIn.then(listen);
      else listen(null);
      return () => {
        stopped = true;
        unsubscribe?.();
      };
    },
    signIn: async (email, password) => {
      if (!supabase) throw new Error('Aplikacja nie jest skonfigurowana.');
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Nieprawidłowy e-mail lub hasło.' : error.message);
    },
    signOut: async () => {
      signingOut = true;
      await supabase?.auth.signOut();
      set({ status: 'signedOut', email: null });
      setMonitoringUser(null);
      signOutOfHub();
    },
  };
});
