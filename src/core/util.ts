// Small helpers: rounding, CSV parsing, HR date parsing.
import { isValidDate } from './calendar';
import type { ISODate } from './types';

export const r1 = (x: number): number => Math.round((x + Number.EPSILON) * 10) / 10;
export const r2 = (x: number): number => Math.round((x + Number.EPSILON) * 100) / 100;
export const sum = (xs: number[]): number => xs.reduce((t, x) => t + x, 0);
/** Tolerance for threshold comparisons (load %, FTE balance). */
export const EPS = 0.005;

/** Plain code-unit string order (matches the Python reference, not locale order). */
export const byText = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/** RFC 4180-style CSV: comma separated, double-quote escaping. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => !(r.length === 1 && r[0].trim() === ''));
}

export function csvObjects(text: string): Record<string, string>[] {
  const [header, ...rows] = parseCsv(text);
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return rows.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

export type DateFormat = 'iso' | 'dotted' | 'slash' | 'blank' | 'bad';

/** HR dates: ISO, YYYY.MM.DD. or DD/MM/YYYY (F8). */
export function parseHrDate(raw: string): { date: ISODate | null; format: DateFormat } {
  const s = (raw ?? '').trim();
  if (!s) return { date: null, format: 'blank' };
  let date: string | null = null;
  let format: DateFormat = 'bad';
  let m: RegExpMatchArray | null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    date = s;
    format = 'iso';
  } else if ((m = s.match(/^(\d{4})\.(\d{2})\.(\d{2})\.?$/))) {
    date = `${m[1]}-${m[2]}-${m[3]}`;
    format = 'dotted';
  } else if ((m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))) {
    date = `${m[3]}-${m[2]}-${m[1]}`;
    format = 'slash';
  }
  if (!date || !isValidDate(date)) return { date: null, format: 'bad' };
  return { date, format };
}
