import type { SavedSignature } from './store';

/**
 * Client for /api/signatures, the team-wide list of saved signatures (see api/signatures.ts).
 * - off: the API is not set up (no database or TEAM_PASSWORD, or the local dev server) → browser-only mode
 * - locked: the team password is missing or wrong
 * - error: the API or the database did not answer; changes wait locally and are sent on the next sync
 */
export type CloudStatus = 'checking' | 'off' | 'locked' | 'ready' | 'error';

export class CloudError extends Error {
  readonly status: Exclude<CloudStatus, 'checking' | 'ready'>;
  constructor(status: CloudError['status']) {
    super(status);
    this.status = status;
  }
}

const ENDPOINT = '/api/signatures';

async function call(password: string, method: 'GET' | 'PUT' | 'DELETE', init: { body?: unknown; id?: string } = {}) {
  let res: Response;
  try {
    res = await fetch(init.id ? `${ENDPOINT}?id=${encodeURIComponent(init.id)}` : ENDPOINT, {
      method,
      headers: { 'x-team-password': password, ...(init.body ? { 'content-type': 'application/json' } : {}) },
      body: init.body ? JSON.stringify(init.body) : undefined,
      cache: 'no-store',
    });
  } catch {
    throw new CloudError('error');
  }
  if (res.status === 401) throw new CloudError('locked');
  // No serverless functions here (vite dev server, static hosting answer 404/405 or the HTML page) or functions
  // without a database (503): stay in browser-only mode.
  const isJson = (res.headers.get('content-type') ?? '').includes('application/json');
  if (res.status === 404 || res.status === 405 || res.status === 503 || (res.ok && !isJson)) throw new CloudError('off');
  if (!res.ok) throw new CloudError('error');
  return res.json() as Promise<unknown>;
}

export async function fetchSignatures(password: string): Promise<SavedSignature[]> {
  const data = (await call(password, 'GET')) as { signatures?: SavedSignature[] };
  if (!Array.isArray(data.signatures)) throw new CloudError('error');
  return data.signatures;
}

export async function putSignature(password: string, signature: SavedSignature): Promise<void> {
  await call(password, 'PUT', { body: { signature } });
}

export async function deleteSignature(password: string, id: string): Promise<void> {
  await call(password, 'DELETE', { id });
}
