// Server errors go to the Vercel logs and, when SENTRY_DSN is set, to Sentry (one project for all Nutri Partners
// apps, see the hub's README, "Monitorowanie i błędy"). Minimal SDK set-up: no tracing, so cold starts stay short.

import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;
if (dsn) {
  Sentry.initWithoutDefaultIntegrations({
    dsn,
    environment: process.env.VERCEL_ENV ?? 'development',
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, httpBodies: [], urlQueryParams: false },
    initialScope: { tags: { app: 'signatures', side: 'server' } },
  });
}

let unsent = false;

/** Turns what libraries throw or return (Supabase errors are plain objects) into an Error with a readable message. */
function toError(where: string, error: unknown): Error {
  if (error instanceof Error) return error;
  const message = typeof error === 'object' && error && 'message' in error ? String(error.message) : String(error);
  return new Error(`${where}: ${message}`);
}

/** Logs an error the person cannot fix themselves (Blob storage or Supabase failing, a bug). */
export function logError(where: string, error: unknown, details?: Record<string, unknown>): void {
  console.error(`[${where}]`, error, ...(details ? [details] : []));
  if (!dsn) return;
  Sentry.withScope((scope) => {
    scope.setTag('where', where);
    if (details) scope.setExtras(details);
    if (error && typeof error === 'object' && !(error instanceof Error)) scope.setExtra('error', error);
    Sentry.captureException(toError(where, error));
  });
  unsent = true;
}

/**
 * Wraps a handler: an unexpected error becomes a 500 answer and is logged, and logged errors are sent before the
 * function returns (Vercel may freeze it right after the response).
 */
export function monitored(where: string, handler: (request: Request) => Promise<Response>) {
  return async (request: Request): Promise<Response> => {
    try {
      return await handler(request);
    } catch (error) {
      logError(where, error);
      return new Response(JSON.stringify({ error: 'server' }), {
        status: 500,
        headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
      });
    } finally {
      if (unsent) {
        unsent = false;
        await Sentry.flush(2000);
      }
    }
  };
}
