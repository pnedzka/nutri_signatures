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
  /** E-mail of the person who saved it last (team database only). */
  updatedBy?: string;
}

// The form and a copy of the saved signatures live in this browser's localStorage. The saved list itself is shared
// by the team in Supabase (lib/cloud.ts): changes are queued in pending/pendingDeletes and sent by flush(), so
// nothing is lost while offline, and connect() replaces the local copy with the team list.
interface SignatureStore {
  overrides: Partial<SignatureData>;
  /** Saved signature currently open in the form, if any. */
  currentId: string | null;
  saved: SavedSignature[];
  update: (patch: Partial<SignatureData>) => void;
  /** Clears the form and detaches it from any saved signature. */
  reset: () => void;
  saveAs: (name: string) => void;
  saveCurrent: () => void;
  open: (id: string) => void;
  remove: (id: string) => void;
  /** Adds or replaces (same id) signatures; returns how many were imported. */
  importMany: (items: SavedSignature[]) => number;

  cloud: CloudStatus;
  /** Ids saved or changed locally and not yet sent to the team database. */
  pending: string[];
  pendingDeletes: string[];
  /** Whether signatures saved only in this browser were already uploaded to the Supabase table. */
  supabaseSynced: boolean;
  /** Loads the team list; first uploads anything waiting locally. */
  connect: () => Promise<CloudStatus>;
  /** Sends queued changes; no-op unless connected. */
  flush: () => Promise<void>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The table's id column is a uuid. */
function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // randomUUID needs a secure context (https or localhost); build a version 4 uuid by hand elsewhere.
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const useSignatureStore = create<SignatureStore>()(
  persist(
    (set, get) => {
      /** The sync in progress, shared by everyone who asks for one meanwhile. */
      let connecting: Promise<CloudStatus> | null = null;

      async function sync(): Promise<CloudStatus> {
        try {
          const remote = await fetchSignatures();
          if (!get().supabaseSynced) {
            // First connection from this browser: upload what was saved only here.
            const remoteIds = new Set(remote.map((r) => r.id));
            set((state) => ({
              supabaseSynced: true,
              ...queued(state, state.saved.filter((s) => !remoteIds.has(s.id)).map((s) => s.id)),
            }));
          }
          set({ cloud: 'ready' });
          await get().flush();
          if (get().cloud !== 'ready') return get().cloud;
          const fresh = get().pending.length || get().pendingDeletes.length ? null : await fetchSignatures();
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
      }

      return {
        overrides: {},
        currentId: null,
        saved: [],
        update: (patch) => set((state) => ({ overrides: { ...state.overrides, ...patch } })),
        reset: () => set({ overrides: {}, currentId: null }),
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
        pending: [],
        pendingDeletes: [],
        supabaseSynced: false,

        // Calls while a sync is running (React StrictMode, a focus event) wait for that one instead of starting another.
        connect: () => (connecting ??= sync().finally(() => (connecting = null))),

        flush: async () => {
          if (get().cloud !== 'ready') return;
          try {
            for (const id of get().pendingDeletes) {
              if (UUID.test(id)) await deleteSignature(id);
              set((state) => ({ pendingDeletes: state.pendingDeletes.filter((d) => d !== id) }));
            }
            for (const id of get().pending) {
              let item = get().saved.find((s) => s.id === id);
              if (item && !UUID.test(item.id)) {
                // Saved by an older version with a non-uuid id: give it a uuid before it goes to the table.
                const renamed = { ...item, id: newId() };
                set((state) => ({
                  saved: state.saved.map((s) => (s.id === id ? renamed : s)),
                  currentId: state.currentId === id ? renamed.id : state.currentId,
                }));
                item = renamed;
              }
              if (item) await putSignature(item);
              set((state) => ({ pending: state.pending.filter((p) => p !== id) }));
            }
          } catch (e) {
            set({ cloud: e instanceof CloudError ? e.status : 'error' });
          }
        },
      };
    },
    {
      name: 'np-email-signature',
      // The connection status is runtime state; the form, the list and the queue survive a reload. Version 1 drops
      // the team password and the Blob-era flag of version 0.
      version: 1,
      migrate: (persisted) => {
        const { teamPassword: _password, cloudMigrated: _migrated, ...rest } = (persisted ?? {}) as Record<string, unknown>;
        void _password;
        void _migrated;
        return rest as unknown as Persisted;
      },
      partialize: ({ overrides, currentId, saved, pending, pendingDeletes, supabaseSynced }) => ({
        overrides,
        currentId,
        saved,
        pending,
        pendingDeletes,
        supabaseSynced,
      }),
    }
  )
);

type Persisted = Pick<SignatureStore, 'overrides' | 'currentId' | 'saved' | 'pending' | 'pendingDeletes' | 'supabaseSynced'>;

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
