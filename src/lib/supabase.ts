import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Shared sign-in of the Nutri Partners apps: the Supabase project of the Document neutralizer. Accounts and access
// (`profiles.apps`) are managed in the Nutri Partners hub. VITE_* works for local development.
const env = import.meta.env;
const url: string | undefined = env.VITE_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
const key: string | undefined =
  env.VITE_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY || env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export const supabase: SupabaseClient | null = url && key ? createClient(url, key) : null;

/** This app's id in `profiles.apps` (nutri_hub shared/access.ts). */
export const APP_ID = 'signatures';

/** The signed-in user's access token, for the API. */
export async function accessToken(): Promise<string | null> {
  const { data } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  return data.session?.access_token ?? null;
}
