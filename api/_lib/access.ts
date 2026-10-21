// Who may use the shared list of signatures: people signed in with the Nutri Partners account (the Supabase project
// of the Document neutralizer) who are administrators or have "signatures" in `profiles.apps` (managed in the hub).
// Only the public (anon) key is needed: the profile is read as the signed-in user, and row level security returns
// only their own row.

import { createClient } from '@supabase/supabase-js';
import { logError } from './monitoring.js';

const APP_ID = 'signatures';
const options = { auth: { persistSession: false, autoRefreshToken: false } };

export type Access = 'ok' | 'not-configured' | 'session' | 'forbidden';

function config() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  return url && key ? { url, key } : null;
}

/** Supabase client acting as the signed-in caller (row level security applies), or null without config or token. */
export function clientAs(request: Request) {
  const cfg = config();
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!cfg || !token) return null;
  return createClient(cfg.url, cfg.key, { ...options, global: { headers: { Authorization: `Bearer ${token}` } } });
}

export async function checkAccess(request: Request): Promise<Access> {
  const cfg = config();
  if (!cfg) return 'not-configured';
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) return 'session';
  // No default Authorization header here: getUser sends the token itself (two headers would read "Bearer x, Bearer x").
  const { data, error } = await createClient(cfg.url, cfg.key, options).auth.getUser(token);
  // A 401 "Invalid API key" means our own SUPABASE_ANON_KEY is wrong, not the person's session: log it.
  if (error && error.status === 401 && /api.?key/i.test(`${error.code ?? ''} ${error.message}`)) logError('access.getUser', error);
  if (error || !data.user) return 'session';
  const asUser = createClient(cfg.url, cfg.key, { ...options, global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: profile, error: profileError } = await asUser.from('profiles').select('role, apps').eq('id', data.user.id).maybeSingle();
  if (profileError) {
    logError('access.profile', profileError);
    return 'session';
  }
  const apps = Array.isArray(profile?.apps) ? (profile.apps as string[]) : [];
  return profile?.role === 'admin' || apps.includes(APP_ID) ? 'ok' : 'forbidden';
}
