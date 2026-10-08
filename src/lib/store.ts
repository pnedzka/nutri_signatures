import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SignatureData } from './signature';
import { CloudError, deleteSignature, fetchSignatures, putSignature, type CloudStatus } from './cloud';

/** A signature the user saved under a name so they can come back and edit it later. */
export interface SavedSignature {
  id: string;
  name: string;
  /** Only the fields that differ from the defaults, same as the live form state. */
  overrides: Partial<SignatureData>;
  updatedAt: string;
}

// The form and a copy of the saved signatures live in this browser's localStorage. When the team database is set
// up (api/signatures.ts) the saved list is shared: changes are queued in pending/pendingDeletes and sent by flush(),
// so nothing is lost while offline, and connect() replaces the local copy with the team list.
interface SignatureStore {
  overrides: Partial<SignatureData>;
  /** Saved signature currently open in the form, if any. */
  currentId: string | null;
  saved: SavedSignature[];
  update: (patch: Partial<SignatureData>) => void;
  saveAs: (name: string) => void;
  saveCurrent: () => void;
  open: (id: string) => void;
  remove: (id: string) => void;
  /** Adds or replaces (same id) signatures; returns how many were imported. */
  importMany: (items: SavedSignature[]) => number;

  cloud: CloudStatus;
  teamPassword: string;
  /** Ids saved or changed locally and not yet sent to the team database. */
  pending: string[];
  pendingDeletes: string[];
  /** Whether signatures saved before the database existed were already uploaded. */
  cloudMigrated: boolean;
  /** Loads the team list (optionally with a new password); first uploads anything waiting locally. */
  connect: (password?: string) => Promise<CloudStatus>;
  /** Sends queued changes; no-op unless connected. */
  flush: () => Promise<void>;
}

function newId(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

export const useSignatureStore = create<SignatureStore>()(
  persist(
    (set, get) => ({
      overrides: {},
      currentId: null,
      saved: [],
      update: (patch) => set((state) => ({ overrides: { ...state.overrides, ...patch } })),
      saveAs: (name) => {
        const item: SavedSignature = {
          id: newId(),
          name: name.trim(),
          overrides: { ...get().overrides },
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({ saved: [item, ...state.saved], currentId: item.id, ...queued(state, [item.id]) }));
        void get().flush();
      },
      saveCurrent: () => {
        const { currentId, overrides } = get();
        if (!currentId) return;
        set((state) => ({
          saved: state.saved.map((s) =>
            s.id === currentId ? { ...s, overrides: { ...overrides }, updatedAt: new Date().toISOString() } : s
          ),
          ...queued(state, [currentId]),
        }));
        void get().flush();
      },
      open: (id) => {
        const item = get().saved.find((s) => s.id === id);
        if (item) set({ overrides: { ...item.overrides }, currentId: id });
      },
      remove: (id) => {
        set((state) => ({
          saved: state.saved.filter((s) => s.id !== id),
          currentId: state.currentId === id ? null : state.currentId,
          pending: state.pending.filter((p) => p !== id),
          pendingDeletes: [...new Set([...state.pendingDeletes, id])],
        }));
        void get().flush();
      },
      importMany: (items) => {
        set((state) => {
          const byId = new Map(state.saved.map((s) => [s.id, s]));
          for (const item of items) byId.set(item.id, item);
          return {
            saved: [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
            ...queued(state, items.map((i) => i.id)),
          };
        });
        void get().flush();
        return items.length;
      },

      cloud: 'checking',
      teamPassword: '',
      pending: [],
      pendingDeletes: [],
      cloudMigrated: false,

      connect: async (password) => {
        if (password !== undefined) set({ teamPassword: password });
        const pass = get().teamPassword;
        try {
          const remote = await fetchSignatures(pass);
          if (!get().cloudMigrated) {
            // First connection from this browser: upload what was saved here before the database existed.
            const remoteIds = new Set(remote.map((r) => r.id));
            set((state) => ({
              cloudMigrated: true,
              ...queued(state, state.saved.filter((s) => !remoteIds.has(s.id)).map((s) => s.id)),
            }));
          }
          set({ cloud: 'ready' });
          await get().flush();
          if (get().cloud !== 'ready') return get().cloud;
          const fresh = get().pending.length || get().pendingDeletes.length ? null : await fetchSignatures(pass);
          if (fresh) {
            set((state) => ({
              saved: fresh,
              currentId: fresh.some((s) => s.id === state.currentId) ? state.currentId : null,
            }));
          }
          return 'ready';
        } catch (e) {
          const status = e instanceof CloudError ? e.status : 'error';
          set({ cloud: status });
          return status;
        }
      },

      flush: async () => {
        if (get().cloud !== 'ready') return;
        const pass = get().teamPassword;
        try {
          for (const id of get().pendingDeletes) {
            await deleteSignature(pass, id);
            set((state) => ({ pendingDeletes: state.pendingDeletes.filter((d) => d !== id) }));
          }
          for (const id of get().pending) {
            const item = get().saved.find((s) => s.id === id);
            if (item) await putSignature(pass, item);
            set((state) => ({ pending: state.pending.filter((p) => p !== id) }));
          }
        } catch (e) {
          set({ cloud: e instanceof CloudError ? e.status : 'error' });
        }
      },
    }),
    {
      name: 'np-email-signature',
      // The connection status is runtime state; everything else (including the queue) survives a reload.
      partialize: (state) =>
        Object.fromEntries(Object.entries(state).filter(([key]) => key !== 'cloud')) as Omit<SignatureStore, 'cloud'>,
    }
  )
);

/** Marks ids for upload (and cancels a queued delete of the same id). */
function queued(state: Pick<SignatureStore, 'pending' | 'pendingDeletes'>, ids: string[]) {
  return {
    pending: [...new Set([...state.pending, ...ids])],
    pendingDeletes: state.pendingDeletes.filter((d) => !ids.includes(d)),
  };
}

/** Key-order independent comparison of two override objects (used for the "unsaved changes" state). */
export function sameOverrides(a: Partial<SignatureData>, b: Partial<SignatureData>): boolean {
  const norm = (o: Partial<SignatureData>) =>
    JSON.stringify(Object.keys(o).sort().map((k) => [k, o[k as keyof SignatureData]]));
  return norm(a) === norm(b);
}

/** Validates an exported file; returns null when it is not a signature export. */
export function parseExport(text: string): SavedSignature[] | null {
  try {
    const json = JSON.parse(text) as { app?: string; signatures?: unknown };
    if (json.app !== 'nutri-signatures' || !Array.isArray(json.signatures)) return null;
    return json.signatures
      .filter(
        (s): s is SavedSignature =>
          typeof s === 'object' &&
          s !== null &&
          typeof (s as SavedSignature).id === 'string' &&
          typeof (s as SavedSignature).name === 'string' &&
          typeof (s as SavedSignature).overrides === 'object' &&
          (s as SavedSignature).overrides !== null
      )
      .map((s) => ({ ...s, updatedAt: typeof s.updatedAt === 'string' ? s.updatedAt : new Date().toISOString() }));
  } catch {
    return null;
  }
}

export function buildExport(saved: SavedSignature[]): string {
  return JSON.stringify({ app: 'nutri-signatures', version: 1, signatures: saved }, null, 2);
}
