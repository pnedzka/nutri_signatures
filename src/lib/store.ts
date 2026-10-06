import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SignatureData } from './signature';

/** A signature the user saved under a name so they can come back and edit it later. */
export interface SavedSignature {
  id: string;
  name: string;
  /** Only the fields that differ from the defaults, same as the live form state. */
  overrides: Partial<SignatureData>;
  updatedAt: string;
}

// Everything lives in this browser's localStorage. Export/import moves saved signatures between devices.
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
      reset: () => set({ overrides: {}, currentId: null }),
      saveAs: (name) => {
        const item: SavedSignature = {
          id: newId(),
          name: name.trim(),
          overrides: { ...get().overrides },
          updatedAt: new Date().toISOString(),
        };
        set((state) => ({ saved: [item, ...state.saved], currentId: item.id }));
      },
      saveCurrent: () => {
        const { currentId, overrides } = get();
        if (!currentId) return;
        set((state) => ({
          saved: state.saved.map((s) =>
            s.id === currentId ? { ...s, overrides: { ...overrides }, updatedAt: new Date().toISOString() } : s
          ),
        }));
      },
      open: (id) => {
        const item = get().saved.find((s) => s.id === id);
        if (item) set({ overrides: { ...item.overrides }, currentId: id });
      },
      remove: (id) =>
        set((state) => ({
          saved: state.saved.filter((s) => s.id !== id),
          currentId: state.currentId === id ? null : state.currentId,
        })),
      importMany: (items) => {
        set((state) => {
          const byId = new Map(state.saved.map((s) => [s.id, s]));
          for (const item of items) byId.set(item.id, item);
          return { saved: [...byId.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) };
        });
        return items.length;
      },
    }),
    { name: 'np-email-signature' }
  )
);

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
