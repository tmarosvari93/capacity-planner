// Edge function `ask` (Lovable Cloud / Supabase). Holds the Anthropic key; two modes:
//   { mode: "choose", question, context }  -> { function, args } | { outOfScope, reason }
//   { mode: "conclude", question, payload } -> { text }
// The browser runs the chosen function from src/core and checks every number in the text.
// Guards (guard.ts): only the app's own origin, capped sizes, a per-IP rate limit.
import {
  DEFAULT_MODEL, MAX_QUESTION, buildChooseRequest, buildConcludeRequest, parseChooseResponse, parseConcludeResponse,
} from './logic.ts';
import { bodyTooLarge, clientKey, corsHeaders, createRateLimiter, isAllowedOrigin } from './guard.ts';

const limiter = createRateLimiter();

async function callClaude(key: string, body: unknown): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 30_000);
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message ?? `Claude API ${res.status}`);
    return data;
  } finally {
    clearTimeout(timer);
  }
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const allowed = isAllowedOrigin(origin, Deno.env.get('ALLOWED_ORIGINS') ?? '');
  const CORS = corsHeaders(origin, allowed);
  const json = (body: unknown, status = 200, extra: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { ...CORS, ...extra, 'Content-Type': 'application/json' } });

  if (req.method === 'OPTIONS') return new Response('ok', { status: allowed ? 200 : 403, headers: CORS });
  if (!allowed) return json({ error: 'origin not allowed' }, 403);
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);

  const rate = limiter.hit(clientKey(req.headers.get('x-forwarded-for'), req.headers.get('x-real-ip')));
  if (!rate.ok) return json({ error: 'Too many questions. Try again in a few minutes.' }, 429, { 'Retry-After': String(rate.retryAfterS) });

  try {
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: 'ANTHROPIC_API_KEY is not set in Lovable Cloud secrets' }, 500);
    const model = Deno.env.get('ASK_MODEL') ?? DEFAULT_MODEL;
    const raw = await req.text();
    if (bodyTooLarge(raw)) return json({ error: 'request too large' }, 413);
    const body = JSON.parse(raw);
    const question = String(body?.question ?? '').trim();
    if (!question) return json({ error: 'question is required' }, 400);
    if (question.length > MAX_QUESTION) return json({ error: `question is longer than ${MAX_QUESTION} characters` }, 400);
    if (body.mode === 'choose') {
      return json(parseChooseResponse(await callClaude(key, buildChooseRequest(question, body.context ?? {}, model))));
    }
    if (body.mode === 'conclude') {
      return json(parseConcludeResponse(await callClaude(key, buildConcludeRequest(question, body.payload ?? {}, model))));
    }
    return json({ error: 'mode must be "choose" or "conclude"' }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
