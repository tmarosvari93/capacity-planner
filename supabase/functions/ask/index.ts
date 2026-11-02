// Edge function `ask` (Lovable Cloud / Supabase). Holds the Anthropic key; two modes:
//   { mode: "choose", question, context }  -> { function, args } | { outOfScope, reason }
//   { mode: "conclude", question, payload } -> { text }
// The browser runs the chosen function from src/core and checks every number in the text.
import {
  DEFAULT_MODEL, buildChooseRequest, buildConcludeRequest, parseChooseResponse, parseConcludeResponse,
} from './logic.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

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
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  try {
    const key = Deno.env.get('ANTHROPIC_API_KEY');
    if (!key) return json({ error: 'ANTHROPIC_API_KEY is not set in Lovable Cloud secrets' }, 500);
    const model = Deno.env.get('ASK_MODEL') ?? DEFAULT_MODEL;
    const body = await req.json();
    const question = String(body?.question ?? '').trim();
    if (!question) return json({ error: 'question is required' }, 400);
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
