import { TODAY, isoWeek, shortDate, weekNote, workingDays, type Week } from '@/core';

/** Column header for a week: date, then "today", "N days" when short/long, or the ISO week. */
export function WeekHead({ w, actual }: { w: Week; actual?: boolean }) {
  const days = workingDays(w);
  const note = weekNote(w);
  const sub = actual ? 'actual' : w === TODAY ? 'today' : days !== 5 ? `${days} days` : isoWeek(w).slice(-3);
  const odd = !actual && w !== TODAY && days !== 5;
  return (
    <div title={note ?? undefined} className="text-center leading-tight">
      <div className={`font-semibold text-[12px] ${odd ? 'text-amber-text' : 'text-ink'}`}>{shortDate(w)}</div>
      <div className="text-[10px] text-hint-2">{sub}</div>
    </div>
  );
}

export const fmtFte = (x: number) => (x > 0 ? `+${x}` : x < 0 ? `−${Math.abs(x)}` : '0');
export const fmtSigned = (x: number) => (x > 0 ? `+${x}` : x < 0 ? `−${Math.abs(x)}` : '±0');
