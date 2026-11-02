// Test helpers: load the real sample files from public/data and the answer key.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect } from 'vitest';
import { loadAll } from '../src/core/importers';
import { applyOverrides, type OverrideLayer } from '../src/core/overrides';
import type { Dataset, Model } from '../src/core/types';

const ROOT = join(__dirname, '..');
export const KEY = JSON.parse(readFileSync(join(ROOT, 'fixtures/answer_key.json'), 'utf8'));
export const readData = async (p: string) => readFileSync(join(ROOT, 'public/data', p), 'utf8');

let cached: Dataset | null = null;
export async function dataset(): Promise<Dataset> {
  cached ??= await loadAll(readData);
  return cached;
}
export async function model(layer?: OverrideLayer): Promise<Model> {
  return applyOverrides(await dataset(), layer);
}

/** Tolerance by field name: percentages ±0.1, euros ±1, hours and FTE ±0.01. */
function tol(path: string): number {
  if (/Eur$/.test(path)) return 1.0001;
  if (/(Pct|loadPct)/i.test(path)) return 0.1001;
  return 0.0101;
}

/** Every key in `expected` must be in `actual` with the same value (numbers within tolerance). Extra keys are allowed. */
export function expectMatches(actual: unknown, expected: unknown, path = '$'): void {
  if (typeof expected === 'number') {
    expect(typeof actual, `${path} type`).toBe('number');
    expect(Math.abs((actual as number) - expected), `${path}: ${actual} vs ${expected}`).toBeLessThanOrEqual(tol(path));
    return;
  }
  if (expected === null || typeof expected !== 'object') {
    expect(actual, path).toEqual(expected);
    return;
  }
  if (Array.isArray(expected)) {
    expect(Array.isArray(actual), `${path} is array`).toBe(true);
    expect((actual as unknown[]).length, `${path} length`).toBe(expected.length);
    expected.forEach((e, i) => expectMatches((actual as unknown[])[i], e, `${path}[${i}]`));
    return;
  }
  expect(actual !== null && typeof actual === 'object', `${path} is object`).toBe(true);
  for (const [k, v] of Object.entries(expected)) {
    expect(Object.prototype.hasOwnProperty.call(actual, k), `${path}.${k} present`).toBe(true);
    expectMatches((actual as Record<string, unknown>)[k], v, `${path}.${k}`);
  }
}
