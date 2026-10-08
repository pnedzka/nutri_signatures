// Shared list of saved signatures for the whole team, stored as private JSON files in Vercel Blob
// (signatures/<id>.json, one file per signature so concurrent saves never overwrite each other).
// Every request needs the team password (TEAM_PASSWORD) in the x-team-password header.
//
//   GET    /api/signatures          → { signatures: SavedSignature[] }
//   PUT    /api/signatures          body { signature: SavedSignature } → { ok: true }
//   DELETE /api/signatures?id=<id>  → { ok: true }
//
// Without a connected Blob store or TEAM_PASSWORD the API answers 503 and the app keeps saving in the browser only.

import { createHash, timingSafeEqual } from 'node:crypto';
import { del, get, list, put } from '@vercel/blob';

const PREFIX = 'signatures/';
const MAX_ITEM_BYTES = 20_000;
/** Ids become file names, so only allow the characters the app generates (UUIDs). */
const ID_PATTERN = /^[A-Za-z0-9_-]{1,100}$/;

const pathFor = (id: string) => `${PREFIX}${id}.json`;

interface SavedSignature {
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

function config() {
  // A Blob store connected to the project sets BLOB_READ_WRITE_TOKEN (or BLOB_STORE_ID with OIDC); the SDK reads it.
  const hasStore = Boolean(process.env.BLOB_READ_WRITE_TOKEN || process.env.BLOB_STORE_ID);
  const password = process.env.TEAM_PASSWORD;
  return hasStore && password ? { password } : null;
}

/** Constant-time comparison (hashing first makes the lengths equal). */
function samePassword(given: string, expected: string): boolean {
  const hash = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(hash(given), hash(expected));
}

/** Reads one signature file, bypassing the CDN cache so a colleague's latest save is visible right away. */
async function readSignature(pathname: string): Promise<SavedSignature | null> {
  const result = await get(pathname, { access: 'private', useCache: false });
  if (!result || !result.stream) return null;
  try {
    const item = JSON.parse(await new Response(result.stream).text()) as unknown;
    return isSignature(item) ? item : null;
  } catch {
    return null; // Skip a corrupted file rather than failing the whole list.
  }
}

function isSignature(value: unknown): value is SavedSignature {
  const s = value as SavedSignature;
  return (
    typeof s === 'object' &&
    s !== null &&
    typeof s.id === 'string' &&
    ID_PATTERN.test(s.id) &&
    typeof s.name === 'string' &&
    s.name.trim().length > 0 &&
    s.name.length <= 200 &&
    typeof s.overrides === 'object' &&
    s.overrides !== null &&
    !Array.isArray(s.overrides) &&
    typeof s.updatedAt === 'string'
  );
}

/** Common checks; returns the config, or the error response to send. */
function guard(request: Request) {
  const cfg = config();
  if (!cfg) return json({ error: 'not-configured' }, 503);
  if (!samePassword(request.headers.get('x-team-password') ?? '', cfg.password)) {
    return json({ error: 'unauthorized' }, 401);
  }
  return cfg;
}

export async function GET(request: Request): Promise<Response> {
  const cfg = guard(request);
  if (cfg instanceof Response) return cfg;
  try {
    const pathnames: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: PREFIX, cursor });
      pathnames.push(...page.blobs.map((b) => b.pathname));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    const signatures = (await Promise.all(pathnames.map(readSignature))).filter((s): s is SavedSignature => s !== null);
    signatures.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return json({ signatures });
  } catch {
    return json({ error: 'storage' }, 502);
  }
}

export async function PUT(request: Request): Promise<Response> {
  const cfg = guard(request);
  if (cfg instanceof Response) return cfg;
  let item: unknown;
  try {
    item = ((await request.json()) as { signature?: unknown }).signature;
  } catch {
    return json({ error: 'bad-request' }, 400);
  }
  if (!isSignature(item)) return json({ error: 'bad-request' }, 400);
  const value = JSON.stringify({ id: item.id, name: item.name.trim(), overrides: item.overrides, updatedAt: item.updatedAt });
  if (value.length > MAX_ITEM_BYTES) return json({ error: 'too-large' }, 413);
  try {
    await put(pathFor(item.id), value, {
      access: 'private',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
    });
    return json({ ok: true });
  } catch {
    return json({ error: 'storage' }, 502);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const cfg = guard(request);
  if (cfg instanceof Response) return cfg;
  const id = new URL(request.url).searchParams.get('id');
  if (!id || !ID_PATTERN.test(id)) return json({ error: 'bad-request' }, 400);
  try {
    await del(pathFor(id));
    return json({ ok: true });
  } catch {
    return json({ error: 'storage' }, 502);
  }
}
