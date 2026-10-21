import type { SavedSignature } from './store';
import { accessToken } from './supabase';

/**
 * Client for /api/signatures, the team-wide list of saved signatures (see api/signatures.ts).
 * - off: the API is not set up (no Blob store, or the local dev server) → browser-only mode
 * - error: the API or the database did not answer, or the session ended; changes wait locally and are sent on the
 *   next sync
 * Access is the shared Nutri Partners sign-in with the `signatures` app; there is no separate team password any more.
 */
export type CloudStatus = 'checking' | 'off' | 'ready' | 'error';

export class CloudError extends Error {
  readonly status: Exclude<CloudStatus, 'checking' | 'ready'>;
  constructor(status: CloudError['status']) {
    super(status);
    this.status = status;
  }
}

const ENDPOINT = '/api/signatures';

async function call(method: 'GET' | 'PUT' | 'DELETE', init: { body?: unknown; id?: string } = {}) {
  const token = await accessToken();
  let res: Response;
  try {
    res = await fetch(init.id ? `${ENDPOINT}?id=${encodeURIComponent(init.id)}` : ENDPOINT, {
      method,
      headers: {
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...(init.body ? { 'content-type': 'application/json' } : {}),
      },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new CloudError('error');
  }
  // An expired session (401) or no access to the generator (403) is an error: the screen handles signing in.
  if (res.status === 401 || res.status === 403) throw new CloudError('error');
  // No serverless functions here (vite dev server, static hosting answer 404/405 or the HTML page) or functions
  // without a database (503): stay in browser-only mode.
  const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
  if (res.status === 404 || res.status === 405 || res.status === 503 || (res.ok && !isJson)) throw new CloudError('off');
  if (!res.ok) throw new CloudError('error');
  return res.json() as Promise<unknown>;
}

export async function fetchSignatures(): Promise<SavedSignature[]> {
  const data = (await call('GET')) as { signatures?: SavedSignature[] };
  if (!Array.isArray(data.signatures)) throw new CloudError('error');
  return data.signatures;
}

export async function putSignature(signature: SavedSignature): Promise<void> {
  await call('PUT', { body: { signature } });
}

export async function deleteSignature(id: string): Promise<void> {
  await call('DELETE', { id });
}
