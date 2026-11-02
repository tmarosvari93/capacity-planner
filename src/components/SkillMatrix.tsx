import { useMemo, useState } from 'react';
import { FUTURE, demandParts, freeCapacity, shortDate, skillGap, stackLabel, type Week } from '@/core';
import { useModel } from '@/state/ModelContext';
import { WeekHead, fmtFte } from './WeekHead';
import { SidePanel } from './SidePanel';

export function SkillMatrix({ title }: { title: string }) {
  const { model } = useModel();
  const from = FUTURE[0];
  const to = FUTURE[FUTURE.length - 1];
  const gap = useMemo(() => skillGap(model, from, to), [model, from, to]);
  const [cell, setCell] = useState<{ stack: string; w: Week } | null>(null);
  const spareMin = model.settings.spareMinFte;

  const header = gap.shortages.length
    ? `${gap.shortages.length} stack${gap.shortages.length > 1 ? 's' : ''} short: ` +
      gap.shortages.map((s) => `${stackLabel(model, s.stack)} from ${shortDate(s.firstWeek)}`).join(' · ')
    : 'No stack runs short';

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 gap-4">
        <h2 className="text-[14px] font-semibold">{title}</h2>
        <span className="text-[12px] text-ink2">{header}</span>
      </div>
      <div className="overflow-x-auto">
        <table className="table-fixed w-full min-w-[1100px] border-collapse text-[12px]">
          <thead>
            <tr className="border-y border-line">
              <th className="eyebrow text-left px-4 py-2 w-[220px] min-w-[220px] border-r-2 border-ink sticky left-0 z-10 bg-white">Skill · stack</th>
              {FUTURE.map((w) => <th key={w} className="px-1 py-2 border-r border-line min-w-[64px]"><WeekHead w={w} /></th>)}
            </tr>
          </thead>
          <tbody>
            {model.allStacks.map((s) => (
              <tr key={s} className="border-b border-line">
                <td title={stackLabel(model, s)} className="px-4 py-1.5 border-r-2 border-ink whitespace-nowrap overflow-hidden text-ellipsis max-w-[220px] sticky left-0 z-10 bg-white">{stackLabel(model, s)}</td>
                {FUTURE.map((w) => {
                  const b = gap.matrix[s][w].balanceFte;
                  const changed = false;
                  const cls = b < 0 ? 'bg-amber-t3 text-amber-text' : b >= spareMin ? 'bg-navy-t1 text-navy' : '';
                  const show = b < 0 || b >= spareMin;
                  return (
                    <td key={w} onClick={() => setCell({ stack: s, w })}
                      className={`text-center font-mono cursor-pointer border-r border-line hover:brightness-95 ${cls} ${changed ? 'outline outline-2 -outline-offset-2 outline-amber' : ''}`}>
                      {show ? fmtFte(b) : ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="px-4 py-2 text-[11px] text-ink2">
        – short, + spare. Orange −n = FTE short that week. Blue +n = FTE spare (free time of people whose main stack it is, shown from {spareMin} FTE).
        Empty = balanced. Click a cell for the breakdown in hours.
      </p>
      {cell && <DemandPanel stack={cell.stack} w={cell.w} onClose={() => setCell(null)} />}
    </section>
  );
}

function DemandPanel({ stack, w, onClose }: { stack: string; w: Week; onClose: () => void }) {
  const { model } = useModel();
  const parts = demandParts(model, stack, w);
  const free = freeCapacity(model, w, stack).people;
  return (
    <SidePanel title={`${stackLabel(model, stack)} · week of ${shortDate(w)}`} onClose={onClose}>
      <div className="eyebrow mb-2">Unstaffed demand</div>
      {parts.length ? (
        <table className="w-full text-[12px] mb-5">
          <tbody>{parts.map((p, i) => (
            <tr key={i} className="border-b border-line"><td className="py-1.5 pr-2">{p.label}<div className="text-[11px] text-hint-2">{p.kind}</div></td>
              <td className="font-mono text-right">{p.hours} h</td></tr>
          ))}</tbody>
        </table>
      ) : <p className="text-[12px] text-hint-2 mb-5">No unstaffed demand this week.</p>}
      <div className="eyebrow mb-2">People with free time (main stack)</div>
      {free.length ? (
        <table className="w-full text-[12px]">
          <tbody>{free.map((p) => (
            <tr key={p.email} className="border-b border-line"><td className="py-1.5">{p.name}</td>
              <td className="font-mono text-right">{p.freeHours} h · {p.freeFte} FTE</td></tr>
          ))}</tbody>
        </table>
      ) : <p className="text-[12px] text-hint-2">Nobody with this main stack has free time.</p>}
    </SidePanel>
  );
}
