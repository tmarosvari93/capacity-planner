import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FUTURE, IN_4_WEEKS, PAST, TODAY, billableSplit, dataIssues, describeScenario, freeCapacity, isoWeek, issueCounts,
  lastSync, loadByPerson, scenarioImpact, shortDate, skillGap, stackLabel, type Scenario,
} from '@/core';
import { useModel } from '@/state/ModelContext';
import { SkillMatrix } from '@/components/SkillMatrix';

const PAIR: Scenario = { projects: { 'P-1': { on: true, startShiftWeeks: 0 }, 'P-2': { on: true, startShiftWeeks: 0 } }, alignStarts: true };
const NEXT4 = FUTURE[4];

const btn = 'border border-input rounded px-2.5 py-1 text-[12px] bg-white hover:bg-hover';

function Tile({ q, big, lines, actions, note }: { q: string; big: ReactNode; lines: ReactNode[]; actions: ReactNode; note?: string }) {
  const nav = useNavigate();
  return (
    <section className="card p-4 flex flex-col">
      <h2 className="text-[12px] font-semibold text-ink2">{q}</h2>
      <div className="text-[19px] font-semibold mt-1.5 mb-1">{big}</div>
      <div className="text-[12px] text-ink2 space-y-0.5 flex-1">{lines.map((l, i) => <div key={i}>{l}</div>)}</div>
      {note && <div className="text-[11px] text-navy-t3 mt-2">with scenario: {note}</div>}
      <div className="flex gap-2 mt-3">
        {actions}
        <button className={btn} onClick={() => nav(`/ask?q=${encodeURIComponent(q)}`)}>Ask about this</button>
      </div>
    </section>
  );
}

const fmtTime = (iso: string) => {
  const d = new Date(iso);
  return isNaN(+d) ? iso : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Budapest' });
};

export default function Home() {
  const { model, scenario, setScenario } = useModel();
  const nav = useNavigate();
  const note = scenario ? describeScenario(model, scenario) : undefined;
  const M = (x: ReactNode) => <span className="font-mono">{x}</span>;

  const gap = useMemo(() => skillGap(model, FUTURE[0], FUTURE[FUTURE.length - 1], scenario), [model, scenario]);
  const load = useMemo(() => loadByPerson(model, TODAY, NEXT4, scenario), [model, scenario]);
  const free = useMemo(() => freeCapacity(model, IN_4_WEEKS, null, scenario), [model, scenario]);
  const pair = useMemo(() => scenarioImpact(model, PAIR), [model]);
  const bill = useMemo(() => billableSplit(model, PAST[0], PAST[PAST.length - 1], 'company'), [model]);

  return (
    <div className="space-y-4">
      <StartBanner />
      <div>
        <div className="eyebrow">Week of Mon {shortDate(TODAY)} 2026 · {isoWeek(TODAY).slice(-3)}</div>
        <h1 className="text-[22px] font-semibold">What needs attention</h1>
      </div>
      <div className="grid grid-cols-4 gap-3">
        <Tile q="Which skill will we run short of?" note={note}
          big={gap.shortages.length ? stackLabel(model, gap.shortages[0].stack) : 'No shortages'}
          lines={gap.shortages.map((s) => <>{stackLabel(model, s.stack)} from w/c {shortDate(s.firstWeek)}, up to {M(s.peakFte)} FTE short</>)}
          actions={<Link className={btn} to="/plan">Open in Plan</Link>} />
        <Tile q="Who is over 100%, and who is idle?" note={note}
          big={<>{M(load.over.length)} over · {M(load.idle.length)} idle</>}
          lines={[
            ...(load.over.length ? [<>Over: {load.over.map((o, i) => <span key={o.email}>{i ? ', ' : ''}{o.name} {M(`${o.peakPct}%`)}</span>)}</>] : []),
            ...(load.idle.length ? [<>Idle: {load.idle.map((o, i) => <span key={o.email}>{i ? ', ' : ''}{o.name} {M(`${o.lowestPct}%`)}</span>)}</>] : []),
            ...(load.plannedWhileAway.length ? [<>Planned while away: {load.plannedWhileAway.map((o) => o.name).join(', ')}</>] : []),
          ]}
          actions={<Link className={btn} to="/plan">Open Plan</Link>} />
        <Tile q={`Who will be available in 4 weeks? (w/c ${shortDate(IN_4_WEEKS)})`} note={note}
          big={<>{M(free.people.length)} people, {M(free.totalFreeHours)} h free</>}
          lines={free.people.slice(0, 4).map((p) => <>{p.name} · {p.mainStack} · {M(p.freeFte)} FTE ({M(p.freeHours)} h)</>)}
          actions={<Link className={btn} to="/plan">Open Plan</Link>} />
        <Tile q="What if two pipeline projects start together?"
          big={<>{M(pair.newlyOver.length)} people over 100%, {M(pair.stackChanges.length)} stacks short</>}
          lines={[
            ...pair.newlyOver.slice(0, 2).map((o) => <>{o.name} from {shortDate(o.firstWeek)}, peak {M(`${o.peakPct}%`)}</>),
            ...(pair.stackChanges.length ? [<>{pair.stackChanges.map((s) => stackLabel(model, s.stack)).join(', ')}</>] : []),
          ]}
          actions={<button className={btn} onClick={() => { setScenario(PAIR); nav('/plan'); }}>Try this scenario</button>} />
        <Tile q="How much of our time went to billable work?"
          big={<>{M(`${bill.company.shareOfLoggedPct ?? '–'}%`)} of logged time <span className="text-[13px] font-normal text-ink2">vs {M(`${bill.targetPct}%`)} target</span></>}
          lines={[<>Utilisation {M(`${bill.company.utilisationPct ?? '–'}%`)} of available hours</>,
            <>{shortDate(PAST[0])} – {shortDate(PAST[PAST.length - 1])} weeks, Jira worklogs</>]}
          actions={<Link className={btn} to="/reports">Open Reports</Link>} />
      </div>

      <SkillMatrix title={`Skill matrix · FTE balance per week, next ${FUTURE.length} weeks`} />

      <div className="grid grid-cols-[1fr_440px] gap-4 items-start">
        <section className="card p-4">
          <h2 className="text-[14px] font-semibold mb-3">People over 100% or idle · this week and next 4</h2>
          {load.over.length + load.idle.length + load.plannedWhileAway.length === 0 ? (
            <p className="text-hint-2">Nobody over or idle</p>
          ) : (
            <table className="w-full text-[12px]">
              <thead><tr className="text-left text-ink2 border-b border-line">
                <th className="py-1.5 font-semibold">Person</th><th className="font-semibold">Stack</th><th className="font-semibold">Status</th>
                <th className="font-semibold">Weeks</th><th className="text-right font-semibold">Peak / lowest</th></tr></thead>
              <tbody>
                {[
                  ...load.over.map((o) => ({ e: o.email, n: o.name, s: 'Over', w: o.weeks, v: `${o.peakPct}%` })),
                  ...load.idle.map((o) => ({ e: o.email, n: o.name, s: 'Idle', w: o.weeks, v: `${o.lowestPct}%` })),
                  ...load.plannedWhileAway.map((o) => ({ e: o.email, n: o.name, s: 'Away', w: o.weeks, v: '–' })),
                ].sort((a, b) => a.n.localeCompare(b.n, 'hu')).map((r) => (
                  <tr key={r.e + r.s} className="border-b border-line">
                    <td className="py-2">{r.n}</td>
                    <td>{model.personByEmail.get(r.e)?.stacks.join(', ')}</td>
                    <td><span className={`text-[11px] font-semibold rounded px-1.5 py-0.5 ${r.s === 'Idle' ? 'bg-hover text-ink2' : 'bg-amber-t3 text-amber-text'}`}>{r.s}</span></td>
                    <td>{r.w.length === 5 ? 'all 5 weeks' : r.w.map(shortDate).join(', ')}</td>
                    <td className="text-right font-mono">{r.v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
        <ImportCard />
      </div>
    </div>
  );
}

const BANNER_KEY = 'capacity.startBannerDismissed';

function StartBanner() {
  const [hidden, setHidden] = useState(() => {
    try { return window.localStorage.getItem(BANNER_KEY) === '1'; } catch { return false; }
  });
  if (hidden) return null;
  const dismiss = () => {
    setHidden(true);
    try { window.localStorage.setItem(BANNER_KEY, '1'); } catch { /* storage unavailable */ }
  };
  return (
    <div className="flex items-center justify-between gap-3 bg-navy-t1 text-navy rounded px-3 py-1.5 text-[12px]">
      <span>New here? <Link to="/start" className="underline font-semibold">Read how this demo works</Link></span>
      <button onClick={dismiss} aria-label="Dismiss" className="px-1.5 rounded hover:bg-white">×</button>
    </div>
  );
}

function ImportCard() {
  const { model, upload } = useModel();
  const issues = dataIssues(model);
  const c = issueCounts(model);
  const input = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const onFile = async (f: File) => {
    const text = await f.text();
    const folder = /\.csv$/i.test(f.name) ? 'hr' : 'jira';
    try { upload(`${folder}/${f.name}`, text); setMsg(`Imported ${f.name}.`); }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
  };

  return (
    <section className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-[14px] font-semibold">Data from last import</h2>
        <button className={btn} onClick={() => input.current?.click()}>Upload newer export</button>
        <input ref={input} type="file" accept=".csv,.json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ''; }} />
      </div>
      {msg && <p className="text-[12px] mb-2 text-navy">{msg}</p>}
      <div className="grid grid-cols-3 gap-2 mb-3">
        {lastSync(model).map((s) => (
          <div key={s.source} className="bg-page rounded px-2 py-1.5 text-[11px]">
            <div className="font-semibold">{s.source}</div><div className="font-mono">{fmtTime(s.exportedAt)}</div>
          </div>
        ))}
      </div>
      <p className="text-[12px] text-ink2 mb-2">
        <span className="font-mono">{c.error}</span> errors, <span className="font-mono">{c.warning}</span> warnings, <span className="font-mono">{c.info}</span> handled silently.
      </p>
      <ul>
        {issues.map((i, k) => (
          <li key={k} className="flex gap-3 py-2 border-b border-line text-[12px]">
            <span className={`h-fit text-[11px] font-semibold rounded px-1.5 py-0.5 ${i.severity === 'info' ? 'bg-hover text-ink2' : 'bg-amber-t3 text-amber-text'}`}>{i.severity}</span>
            <div>
              <div>{i.text}</div>
              <div className="text-[11px] text-hint-2">
                {i.file}{i.row != null ? ` row ${i.row}` : ''} · rule {i.rule}
                {i.fixIn && <> · <Link to="/admin" className="underline text-navy">Fix in Admin</Link></>}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
