// Request guards for the `ask` edge function. Pure code, no Deno APIs, so Vitest can test it.
// They keep strangers from spending the Anthropic budget:
//   1. Origin: only the app's own pages (and localhost) may call it from a browser.
//   2. Size: question and body are capped, so one call cannot send a huge prompt.
//   3. Rate: each client IP gets a small number of calls per window.
// Limits of this approach: a non-browser client can fake the Origin header, and the rate
// counter lives in memory, so it resets when the function cold-starts. The real fix is
// sign-in; until then a monthly spend cap on the Anthropic key is the backstop.

export const MAX_BODY_BYTES = 64_000;
export const RATE_LIMIT = 30;            // calls per IP per window (one question = 2 calls)
export const RATE_WINDOW_MS = 10 * 60_000;

const DEFAULT_ORIGINS = [
  /^https:\/\/([a-z0-9-]+\.)*lovable\.app$/,
  /^https:\/\/([a-z0-9-]+\.)*lovableproject\.com$/,
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
];

/** `extra` is a comma-separated list of exact origins (env ALLOWED_ORIGINS). */
export function isAllowedOrigin(origin: string | null, extra = ''): boolean {
  if (!origin) return false;
  const exact = extra.split(',').map((s) => s.trim()).filter(Boolean);
  return exact.includes(origin) || DEFAULT_ORIGINS.some((re) => re.test(origin));
}

export function corsHeaders(origin: string | null, allowed: boolean): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': allowed && origin ? origin : 'null',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  };
}

/** First address in x-forwarded-for, else a fallback. */
export function clientKey(forwardedFor: string | null, realIp: string | null): string {
  const first = (forwardedFor ?? '').split(',')[0].trim();
  return first || (realIp ?? '').trim() || 'unknown';
}

export type RateLimiter = { hit(key: string, now?: number): { ok: boolean; retryAfterS: number } };

export function createRateLimiter(limit = RATE_LIMIT, windowMs = RATE_WINDOW_MS): RateLimiter {
  const hits = new Map<string, number[]>();
  return {
    hit(key, now = Date.now()) {
      const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return { ok: false, retryAfterS: Math.ceil((windowMs - (now - recent[0])) / 1000) };
      }
      recent.push(now);
      hits.set(key, recent);
      if (hits.size > 5_000) {
        for (const [k, ts] of hits) if (!ts.some((t) => now - t < windowMs)) hits.delete(k);
      }
      return { ok: true, retryAfterS: 0 };
    },
  };
}

export function bodyTooLarge(raw: string): boolean {
  return new TextEncoder().encode(raw).length > MAX_BODY_BYTES;
}
