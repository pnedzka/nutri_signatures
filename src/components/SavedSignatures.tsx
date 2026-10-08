import { useEffect, useRef, useState } from 'react';
import { Bookmark, Cloud, CloudOff, FileDown, FileUp, FolderOpen, Lock, RefreshCw, Save, Trash2 } from 'lucide-react';
import { Card, CardBody, CardHeader } from './Card';
import { Button } from './Button';
import { Input } from './Input';
import { useToast } from '../lib/toast';
import { buildExport, parseExport, sameOverrides, useSignatureStore } from '../lib/store';
import { TEMPLATES, type SignatureData } from '../lib/signature';

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleString('pl-PL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function templateName(overrides: Partial<SignatureData>): string {
  return TEMPLATES.find((t) => t.id === (overrides.template ?? 'modern'))?.name ?? '';
}

/** Save the form under a name, reopen saved signatures for editing, delete them, export/import them. */
export function SavedSignatures({ suggestedName }: { suggestedName: string }) {
  const { overrides, currentId, saved, saveAs, saveCurrent, open, remove, importMany, cloud, connect } =
    useSignatureStore();
  const toast = useToast();
  const [password, setPassword] = useState('');
  const shared = cloud === 'ready';

  // Load the team list on start and when the tab comes back into focus (a colleague may have changed it), at most
  // once a minute: every refresh lists the Blob store, which counts towards the plan's operation quota.
  useEffect(() => {
    let lastSync = Date.now();
    void useSignatureStore.getState().connect();
    const onFocus = () => {
      const status = useSignatureStore.getState().cloud;
      if ((status === 'ready' || status === 'error') && Date.now() - lastSync > 60_000) {
        lastSync = Date.now();
        void useSignatureStore.getState().connect();
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, []);

  const submitPassword = async () => {
    if (!password.trim()) return;
    const status = await connect(password.trim());
    if (status === 'ready') {
      setPassword('');
      toast.success('Połączono z bazą stopek', 'Widzisz teraz wspólne stopki całego zespołu.');
    } else if (status === 'locked') {
      toast.error('Nieprawidłowe hasło', 'Sprawdź hasło zespołu i spróbuj ponownie.');
    } else {
      toast.error('Brak połączenia z bazą', 'Spróbuj ponownie za chwilę.');
    }
  };
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');
  // Inline confirmation for destructive actions: which row asks, and what for.
  const [confirm, setConfirm] = useState<{ id: string; action: 'delete' | 'open' } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const current = saved.find((s) => s.id === currentId) ?? null;
  const dirty = current ? !sameOverrides(current.overrides, overrides) : Object.keys(overrides).length > 0;

  const startNaming = () => {
    setName(suggestedName);
    setNaming(true);
  };

  const submitName = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    saveAs(trimmed);
    setNaming(false);
    toast.success(
      'Stopka zapisana',
      shared ? `„${trimmed}” jest teraz na wspólnej liście zespołu.` : `„${trimmed}” znajdziesz na liście zapisanych stopek.`
    );
  };

  const handleSaveChanges = () => {
    saveCurrent();
    toast.success('Zmiany zapisane', current ? `„${current.name}”` : undefined);
  };

  const handleOpen = (id: string) => {
    if (dirty && id !== currentId && confirm?.id !== id) {
      setConfirm({ id, action: 'open' });
      return;
    }
    open(id);
    setConfirm(null);
    const item = saved.find((s) => s.id === id);
    if (item) toast.info('Otwarto stopkę', `„${item.name}”`);
  };

  const handleDelete = (id: string) => {
    if (confirm?.id !== id || confirm.action !== 'delete') {
      setConfirm({ id, action: 'delete' });
      return;
    }
    const item = saved.find((s) => s.id === id);
    remove(id);
    setConfirm(null);
    if (item) toast.info('Stopka usunięta', `„${item.name}”`);
  };

  const handleExport = () => {
    const blob = new Blob([buildExport(saved)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stopki-nutri-partners-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (file: File) => {
    const items = parseExport(await file.text());
    if (!items) {
      toast.error('Nie udało się zaimportować', 'To nie jest plik wyeksportowany z generatora stopek.');
      return;
    }
    const count = importMany(items);
    toast.success('Zaimportowano stopki', `Liczba stopek: ${count}.`);
  };

  return (
    <Card>
      <CardHeader className="flex items-center gap-2">
        <span className="text-[#CC1F1F]">
          <Bookmark size={16} />
        </span>
        <h3 className="text-sm font-semibold text-gray-900">Zapisane stopki</h3>
      </CardHeader>
      <CardBody className="space-y-4">
        {current && (
          <div className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2">
            <p className="text-sm text-gray-700 min-w-0">
              Edytujesz: <span className="font-semibold text-gray-900 break-words">{current.name}</span>
            </p>
            {dirty && (
              <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                Niezapisane zmiany
              </span>
            )}
          </div>
        )}

        {naming ? (
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              submitName();
            }}
          >
            <div className="flex-1 min-w-0">
              <Input
                id="saved-name"
                label="Nazwa stopki"
                value={name}
                autoFocus
                onChange={(e) => setName(e.target.value)}
                placeholder="np. Paweł – wersja EN"
              />
            </div>
            <Button type="submit" disabled={!name.trim()}>
              Zapisz
            </Button>
            <Button type="button" variant="ghost" onClick={() => setNaming(false)}>
              Anuluj
            </Button>
          </form>
        ) : (
          <div className="flex flex-wrap gap-2">
            {current ? (
              <>
                <Button onClick={handleSaveChanges} disabled={!dirty}>
                  <Save size={16} />
                  Zapisz zmiany
                </Button>
                <Button variant="secondary" onClick={startNaming}>
                  Zapisz jako nową
                </Button>
              </>
            ) : (
              <Button onClick={startNaming}>
                <Save size={16} />
                Zapisz stopkę
              </Button>
            )}
          </div>
        )}

        {saved.length === 0 ? (
          <p className="text-xs text-gray-500">
            Nie masz jeszcze zapisanych stopek. Zapisz bieżącą, aby później wrócić do jej edycji.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100 rounded-lg border border-gray-100" aria-label="Zapisane stopki">
            {saved.map((s) => {
              const isCurrent = s.id === currentId;
              const asking = confirm?.id === s.id ? confirm.action : null;
              return (
                <li key={s.id} className={`flex items-center gap-3 px-3 py-2.5 ${isCurrent ? 'bg-red-50/40' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                    <p className="text-xs text-gray-500 truncate">
                      {templateName(s.overrides)} · {formatDate(s.updatedAt)}
                    </p>
                  </div>
                  {asking ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-gray-600 mr-1">
                        {asking === 'delete' ? (shared ? 'Usunąć dla wszystkich?' : 'Usunąć?') : 'Porzucić zmiany?'}
                      </span>
                      <Button
                        size="sm"
                        variant={asking === 'delete' ? 'danger' : 'secondary'}
                        onClick={() => (asking === 'delete' ? handleDelete(s.id) : handleOpen(s.id))}
                      >
                        Tak
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                        Nie
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 shrink-0">
                      {!isCurrent && (
                        <Button size="sm" variant="secondary" onClick={() => handleOpen(s.id)} aria-label={`Otwórz ${s.name}`}>
                          <FolderOpen size={14} />
                          Otwórz
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(s.id)} aria-label={`Usuń ${s.name}`}>
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        {cloud === 'locked' && (
          <form
            className="rounded-lg border border-gray-100 bg-gray-50 p-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              void submitPassword();
            }}
          >
            <p className="flex items-start gap-2 text-xs text-gray-600">
              <Lock size={14} className="shrink-0 mt-0.5" />
              Podaj hasło zespołu, aby zobaczyć wspólne stopki firmy i zapisywać je w bazie.
            </p>
            <div className="flex items-end gap-2">
              <div className="flex-1 min-w-0">
                <Input
                  id="team-password"
                  label="Hasło zespołu"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
              <Button type="submit" disabled={!password.trim()}>
                Połącz
              </Button>
            </div>
          </form>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <StorageNote status={cloud} onRetry={() => void connect()} />
          <div className="flex gap-1">
            <Button size="sm" variant="ghost" onClick={handleExport} disabled={saved.length === 0}>
              <FileDown size={14} />
              Eksportuj
            </Button>
            <Button size="sm" variant="ghost" onClick={() => fileInput.current?.click()}>
              <FileUp size={14} />
              Importuj
            </Button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleImport(file);
                e.target.value = '';
              }}
            />
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

function StorageNote({ status, onRetry }: { status: ReturnType<typeof useSignatureStore.getState>['cloud']; onRetry: () => void }) {
  if (status === 'ready') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-gray-500">
        <Cloud size={14} className="text-emerald-600" />
        Wspólna baza zespołu
      </p>
    );
  }
  if (status === 'error') {
    return (
      <p className="flex items-center gap-1.5 text-xs text-amber-700">
        <CloudOff size={14} />
        Brak połączenia z bazą — zmiany czekają w tej przeglądarce.
        <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-medium underline">
          <RefreshCw size={12} />
          Ponów
        </button>
      </p>
    );
  }
  if (status === 'locked') return <p className="text-xs text-gray-500">Bez hasła stopki zapisują się tylko w tej przeglądarce.</p>;
  return <p className="text-xs text-gray-500">Stopki zapisują się w tej przeglądarce.</p>;
}
