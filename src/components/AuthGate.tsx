import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { ExternalLink, LayoutGrid, Lock, Mail } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { HUB_URL } from '../lib/hub';
import { Button } from './Button';
import { Card, CardBody } from './Card';
import { Input } from './Input';

function Screen({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="Nutri Partners" width={180} height={35} />
          <p className="mt-3 text-sm text-gray-500">Generator stopek e-mail</p>
        </div>
        <Card>
          <CardBody className="py-6">{children}</CardBody>
        </Card>
      </div>
    </div>
  );
}

const hubButton = (
  <a
    href={HUB_URL}
    className="flex items-center justify-center gap-2 min-h-11 rounded-lg bg-[#CC1F1F] px-4 py-2 text-sm font-medium text-white hover:bg-[#A01818]"
  >
    <LayoutGrid size={16} />
    Wszystkie aplikacje
  </a>
);

function LoginForm() {
  const signIn = useAuth((s) => s.signIn);
  const authError = useAuth((s) => s.error);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signIn(email.trim(), password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Input label="E-mail" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} leftIcon={<Mail size={16} />} />
      <Input label="Hasło" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} leftIcon={<Lock size={16} />} />
      {(error ?? authError) && <p className="text-sm text-red-600">{error ?? authError}</p>}
      <Button type="submit" className="w-full min-h-11" isLoading={busy}>
        Zaloguj się
      </Button>
      <a href={HUB_URL} className="flex items-center justify-center gap-1 min-h-11 sm:min-h-0 text-xs text-gray-500 hover:text-gray-700 text-center">
        Nie pamiętasz hasła? Zresetuj je w aplikacjach Nutri Partners
        <ExternalLink size={12} />
      </a>
      <p className="text-xs text-gray-500 text-center">Użyj konta Nutri Partners. Konta zakłada administrator.</p>
    </form>
  );
}

/** The generator is open only to people signed in with access to it (`profiles.apps`, managed in the hub). */
export function AuthGate({ children }: { children: ReactNode }) {
  const { status, email, error, init, signOut } = useAuth();
  useEffect(() => init(), [init]);

  if (status === 'signedIn') return <>{children}</>;
  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center text-sm text-gray-500">
        <span className="animate-spin h-5 w-5 mr-3 rounded-full border-2 border-gray-300 border-t-[#CC1F1F]" />
        Wczytywanie…
      </div>
    );
  }
  if (status === 'unconfigured') {
    return (
      <Screen>
        <p className="text-sm text-gray-600">
          Brakuje połączenia z logowaniem (<code>NEXT_PUBLIC_SUPABASE_URL</code> i <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>). Zob. README.
        </p>
      </Screen>
    );
  }
  if (status === 'signedOut') {
    return (
      <Screen>
        <LoginForm />
      </Screen>
    );
  }
  return (
    <Screen>
      <div className="space-y-4">
        <p className="text-sm text-red-700">
          {status === 'noAccess'
            ? `Konto ${email ?? ''} nie ma dostępu do generatora stopek. Poproś administratora o dostęp w aplikacjach Nutri Partners.`
            : error}
        </p>
        {hubButton}
        <Button variant="secondary" className="w-full min-h-11" onClick={() => void signOut()}>
          Wyloguj się
        </Button>
      </div>
    </Screen>
  );
}
