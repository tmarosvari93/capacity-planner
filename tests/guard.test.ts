import { describe, expect, it } from 'vitest';
import {
  MAX_BODY_BYTES, RATE_LIMIT, RATE_WINDOW_MS, bodyTooLarge, clientKey, corsHeaders, createRateLimiter, isAllowedOrigin,
} from '../supabase/functions/ask/guard';

describe('ask guard: origin', () => {
  it('allows the live app, Lovable previews and localhost', () => {
    expect(isAllowedOrigin('https://future-fit-capacity-map.lovable.app')).toBe(true);
    expect(isAllowedOrigin('https://id-preview--abc123.lovable.app')).toBe(true);
    expect(isAllowedOrigin('https://abc123.lovableproject.com')).toBe(true);
    expect(isAllowedOrigin('http://localhost:8080')).toBe(true);
  });
  it('refuses other sites, look-alikes and a missing origin', () => {
    expect(isAllowedOrigin('https://evil.example')).toBe(false);
    expect(isAllowedOrigin('https://lovable.app.evil.example')).toBe(false);
    expect(isAllowedOrigin('http://future-fit-capacity-map.lovable.app')).toBe(false);
    expect(isAllowedOrigin(null)).toBe(false);
  });
  it('accepts extra exact origins from ALLOWED_ORIGINS', () => {
    expect(isAllowedOrigin('https://planner.example', 'https://a.example, https://planner.example')).toBe(true);
  });
  it('echoes only an allowed origin in CORS', () => {
    expect(corsHeaders('https://x.lovable.app', true)['Access-Control-Allow-Origin']).toBe('https://x.lovable.app');
    expect(corsHeaders('https://evil.example', false)['Access-Control-Allow-Origin']).toBe('null');
  });
});

describe('ask guard: rate limit', () => {
  it(`allows ${RATE_LIMIT} calls per IP per window, then refuses`, () => {
    const rl = createRateLimiter();
    for (let i = 0; i < RATE_LIMIT; i++) expect(rl.hit('1.1.1.1', 1000 + i).ok).toBe(true);
    const blocked = rl.hit('1.1.1.1', 2000);
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterS).toBeGreaterThan(0);
    expect(rl.hit('2.2.2.2', 2000).ok).toBe(true);
  });
  it('lets the IP back in after the window', () => {
    const rl = createRateLimiter(2, 1000);
    rl.hit('a', 0); rl.hit('a', 10);
    expect(rl.hit('a', 500).ok).toBe(false);
    expect(rl.hit('a', 1011).ok).toBe(true);
    expect(RATE_WINDOW_MS).toBe(600_000);
  });
  it('keys on the first forwarded address', () => {
    expect(clientKey('9.9.9.9, 10.0.0.1', null)).toBe('9.9.9.9');
    expect(clientKey(null, '8.8.8.8')).toBe('8.8.8.8');
    expect(clientKey(null, null)).toBe('unknown');
  });
});

describe('ask guard: size', () => {
  it('refuses a body over the cap', () => {
    expect(bodyTooLarge('x'.repeat(MAX_BODY_BYTES))).toBe(false);
    expect(bodyTooLarge('x'.repeat(MAX_BODY_BYTES + 1))).toBe(true);
  });
});
