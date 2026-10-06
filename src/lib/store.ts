import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SignatureData } from './signature';

// Only fields the user changed are stored (per browser); everything else uses the defaults.
interface SignatureStore {
  overrides: Partial<SignatureData>;
  update: (patch: Partial<SignatureData>) => void;
  reset: () => void;
}

export const useSignatureStore = create<SignatureStore>()(
  persist(
    (set) => ({
      overrides: {},
      update: (patch) => set((state) => ({ overrides: { ...state.overrides, ...patch } })),
      reset: () => set({ overrides: {} }),
    }),
    { name: 'np-email-signature' }
  )
);
