// Shared list of saved signatures for the whole team, stored in Upstash Redis (Vercel → Storage → Upstash for
// Redis). Every request needs the team password (TEAM_PASSWORD) in the x-team-password header.
//
//   GET    /api/signatures          → { signatures: SavedSignature[] }
//   PUT    /api/signatures          body { signature: SavedSignature } → { ok: true }
//   DELETE /api/signatures?id=<id>  → { ok: true }
//
// Without the Redis variables or TEAM_PASSWORD the API answers 503 and the app keeps saving in the browser only.

import { createHash, timingSafeEqual } from 'node:crypto';

const KEY = 'np:signatures';
const MAX_ITEMS = 500;
const MAX_ITEM_BYTES = 20_000;

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
  // Vercel's Upstash integration sets the KV_* names; the UPSTASH_* names come from a manual Upstash setup.
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;
  const password = process.env.TEAM_PASSWORD;
  return url && token && password ? { url, token, password } : null;
}

/** Constant-time comparison (hashing first makes the lengths equal). */
function samePassword(given: string, expected: string): boolean {
  const hash = (s: string) => createHash('sha256').update(s).digest();
  return timingSafeEqual(hash(given), hash(expected));
}

async function redis(url: string, token: string, command: (string | number)[]): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(command),
  });
  const data = (await res.json()) as { result?: unknown; error?: string };
  if (!res.ok || data.error) throw new Error(data.error ?? `Redis HTTP ${res.status}`);
  return data.result;
}

function isSignature(value: unknown): value is SavedSignature {
  const s = value as SavedSignature;
  return (
    typeof s === 'object' &&
    s !== null &&
    typeof s.id === 'string' &&
    s.id.length > 0 &&
    s.id.length <= 100 &&
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
    // HGETALL returns [field, value, field, value, …].
    const flat = ((await redis(cfg.url, cfg.token, ['HGETALL', KEY])) as string[] | null) ?? [];
    const signatures: SavedSignature[] = [];
    for (let i = 1; i < flat.length; i += 2) {
      try {
        const item = JSON.parse(flat[i]) as unknown;
        if (isSignature(item)) signatures.push(item);
      } catch {
        // Skip a corrupted entry rather than failing the whole list.
      }
    }
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
    const exists = await redis(cfg.url, cfg.token, ['HEXISTS', KEY, item.id]);
    if (!exists && Number(await redis(cfg.url, cfg.token, ['HLEN', KEY])) >= MAX_ITEMS) {
      return json({ error: 'too-many' }, 409);
    }
    await redis(cfg.url, cfg.token, ['HSET', KEY, item.id, value]);
    return json({ ok: true });
  } catch {
    return json({ error: 'storage' }, 502);
  }
}

export async function DELETE(request: Request): Promise<Response> {
  const cfg = guard(request);
  if (cfg instanceof Response) return cfg;
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return json({ error: 'bad-request' }, 400);
  try {
    await redis(cfg.url, cfg.token, ['HDEL', KEY, id]);
    return json({ ok: true });
  } catch {
    return json({ error: 'storage' }, 502);
  }
}
