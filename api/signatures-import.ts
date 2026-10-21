// One-time move of the saved signatures from Vercel Blob (signatures/<id>.json, used before the shared Supabase
// table) into `email_signatures`. Called by the app when the table is empty; imports only into an empty table, so a
// signature deleted later never comes back. Runs as the signed-in caller: row level security checks their access.
//
//   POST /api/signatures-import → { imported: number }
//
// 503 without a Blob store (dev environment) or without Supabase. Once the import is done, the Blob store and this
// file can be removed.

import { createHash } from 'node:crypto';
import { get, list } from '@vercel/blob';
import { checkAccess, clientAs } from './_lib/access.js';
import { logError, monitored } from './_lib/monitoring.js';

const PREFIX = 'signatures/';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface BlobSignature {
  id: string;
  name: string;
  overrides: Record<string, unknown>;
  updatedAt: string;
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });
}

function isSignature(value: unknown): value is BlobSignature {
  const s = value as BlobSignature;
  return (
    typeof s === 'object' &&
    s !== null &&
    typeof s.id === 'string' &&
    typeof s.name === 'string' &&
    s.name.trim().length > 0 &&
    typeof s.overrides === 'object' &&
    s.overrides !== null &&
    !Array.isArray(s.overrides) &&
    typeof s.updatedAt === 'string' &&
    !Number.isNaN(Date.parse(s.updatedAt))
  );
}

/** The table needs a uuid; an older non-uuid id gets a stable one derived from it (same id → same uuid). */
function toUuid(id: string): string {
  if (UUID.test(id)) return id.toLowerCase();
  const h = createHash('sha256').update(`nutri-signatures:${id}`).digest('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 0x3) | 0x8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

async function readBlob(pathname: string): Promise<BlobSignature | null> {
  const result = await get(pathname, { access: 'private', useCache: false });
  if (!result || !result.stream) return null;
  try {
    const item = JSON.parse(await new Response(result.stream).text()) as unknown;
    return isSignature(item) ? item : null;
  } catch {
    return null;
  }
}

export const POST = monitored('signatures.import', async (request) => {
  if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.BLOB_STORE_ID) return json({ error: 'not-configured' }, 503);
  const access = await checkAccess(request);
  if (access === 'not-configured') return json({ error: 'not-configured' }, 503);
  if (access === 'session') return json({ error: 'session' }, 401);
  if (access === 'forbidden') return json({ error: 'forbidden' }, 403);
  const db = clientAs(request);
  if (!db) return json({ error: 'session' }, 401);

  const { count, error: countError } = await db.from('email_signatures').select('id', { count: 'exact', head: true });
  if (countError) {
    logError('signatures.import', countError, { step: 'count' });
    return json({ error: 'database' }, 502);
  }
  if ((count ?? 0) > 0) return json({ imported: 0 });

  let items: BlobSignature[];
  try {
    const pathnames: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: PREFIX, cursor });
      pathnames.push(...page.blobs.map((b) => b.pathname));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    items = (await Promise.all(pathnames.map(readBlob))).filter((s): s is BlobSignature => s !== null);
  } catch (error) {
    logError('signatures.import', error, { step: 'blob' });
    return json({ error: 'storage' }, 502);
  }
  if (!items.length) return json({ imported: 0 });

  const rows = items.map((s) => ({
    id: toUuid(s.id),
    name: s.name.trim().slice(0, 200),
    overrides: s.overrides,
    updated_at: s.updatedAt,
  }));
  // Two people opening the app at once both import the same ids: the second insert skips them.
  const { error } = await db.from('email_signatures').upsert(rows, { onConflict: 'id', ignoreDuplicates: true });
  if (error) {
    logError('signatures.import', error, { step: 'insert', count: rows.length });
    return json({ error: 'database' }, 502);
  }
  return json({ imported: rows.length });
});
