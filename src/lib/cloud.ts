import type { SavedSignature } from './store';
import { supabase } from './supabase';

/**
 * The team-wide list of saved signatures: table `email_signatures` in the shared Nutri Partners Supabase (schema in
 * `db/schema.sql` of pnedzka/nutri_documentation). Read and written in the browser with the signed-in user's
 * session; row level security lets in administrators and people with `signatures` in `profiles.apps`.
 * - off: no Supabase here, or the table does not exist yet → saved signatures stay in this browser
 * - error: Supabase did not answer or refused; changes wait locally and are sent on the next sync
 */
export type CloudStatus = 'checking' | 'off' | 'ready' | 'error';

export class CloudError extends Error {
  readonly status: Exclude<CloudStatus, 'checking' | 'ready'>;
  constructor(status: CloudError['status']) {
    super(status);
    this.status = status;
  }
}

const TABLE = 'email_signatures';

interface Row {
  id: string;
  name: string;
  overrides: SavedSignature['overrides'] | null;
  updated_at: string;
  updated_by_email: string | null;
}

function client() {
  if (!supabase) throw new CloudError('off');
  return supabase;
}

function fail(error: { code?: string }): never {
  // PGRST205 / 42P01: the table is not there yet (database not migrated), so work as before, in the browser.
  throw new CloudError(error.code === 'PGRST205' || error.code === '42P01' ? 'off' : 'error');
}

export async function fetchSignatures(): Promise<SavedSignature[]> {
  let result;
  try {
    result = await client()
      .from(TABLE)
      .select('id, name, overrides, updated_at, updated_by_email')
      .order('updated_at', { ascending: false });
  } catch (e) {
    throw e instanceof CloudError ? e : new CloudError('error');
  }
  if (result.error) fail(result.error);
  return (result.data as Row[]).map((r) => ({
    id: r.id,
    name: r.name,
    overrides: r.overrides ?? {},
    updatedAt: r.updated_at,
    updatedBy: r.updated_by_email ?? undefined,
  }));
}

/** Inserts or updates; the database records who saved it and when (a trigger, not the browser). */
export async function putSignature(signature: SavedSignature): Promise<void> {
  const { error } = await client()
    .from(TABLE)
    .upsert(
      { id: signature.id, name: signature.name, overrides: signature.overrides, updated_at: signature.updatedAt },
      { onConflict: 'id' }
    );
  if (error) fail(error);
}

export async function deleteSignature(id: string): Promise<void> {
  const { error } = await client().from(TABLE).delete().eq('id', id);
  if (error) fail(error);
}
