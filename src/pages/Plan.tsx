import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  FUTURE, PAST, TODAY, absenceDays, actualHours, actualRows, allocationRows, availabilityFormula, demandFte, driftHours,
  employedDates, loadPct, plannedRows, projectLastWeek, r1, resolveScenario, scenarioImpact, setAlignStarts, setProjectOn,
  shiftProject, shortDate, stackLabel, type Person, type Week,
} from '@/core';
import { useModel } from '@/state/ModelContext';
import { SkillMatrix } from '@/components/SkillMatrix';
import { SidePanel } from '@/components/SidePanel';
import { WeekHead, fmtSigned } from '@/components/WeekHead';

const COL = '';
const STICKY_L = 'sticky left-0 z-20 bg-white';
const STICKY_R = 'sticky right-0 z-20 bg-white';
const HELP_KEY = 'plan-help-seen';

export default function Plan() {
  const last = FUTURE[FUTURE.length - 1];
  const { scenario } = useModel();
  return (
    <div className="space-y-4 min-w-0">
      <div>
        <h1 className="text-[22px] font-semibold">Plan</h1>
        <p className="text-ink2">{shortDate(FUTURE[0])} 2026 – {shortDate(last)} 2027 (week of), {FUTURE.length} weeks.</p>
      </div>
      <HelpBar />
      <PipelineCard />
      <SkillMatrix title="Skill matrix · FTE balance per week" scenario={scenario} />
      <PeopleGrid />
    </div>
  );
}

function HelpBar() {
  const [open, setOpen] = useState(() => {
    try { return !localStorage.getItem(HELP_KEY); } catch { return true; }
  });
  useEffect(() => { try { localStorage.setItem(HELP_KEY, '1'); } catch { /* ignore */ } }, []);
  return (
    <section className="card text-[12px] text-ink2">
      <button aria-expanded={open} onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left">
        <span className="text-[13px] font-semibold text-ink">How to use this page</span>
        <span aria-hidden className="text-ink2">{open ? '▲ Hide' : '▼ Show'}</span>
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 px-4 pb-3">
          <p>1. Orange cells in the skill matrix are weeks a stack runs short.</p>
          <p>2. Switch pipeline deals on to see their effect; shift them or align their starts.</p>
          <p>3. Click a person's cell to see the hours behind it and change future hours.</p>
          <p>4. Every change applies at once; Reset Admin and Plan edits undoes all of them, including pipeline shifts.</p>
        </div>
      )}
    </section>
  );
}

function PipelineCard() {
  const { model, scenario, setScenario } = useModel();
  const pipeline = model.projects.filter((p) => p.type === 'pipeline');
  const starts = resolveScenario(model, scenario);
  const impact = useMemo(() => (scenario ? scenarioImpact(model, scenario) : null), [model, scenario]);
  const nameOf = (e: string | null) => (e ? model.personByEmail.get(e)?.name ?? e : null);

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3">
        <h2 className="text-[14px] font-semibold">Pipeline</h2>
        <span className="text-[12px] text-ink2 flex-1">All off = signed and internal work only. Switch a deal on to see its effect on shortages and people below.</span>
        <Link to="/admin" className="border border-input rounded px-2.5 py-1 text-[12px] hover:bg-hover">+ Add project</Link>
        <button onClick={() => setScenario(undefined)} className="border border-input rounded px-2.5 py-1 text-[12px] hover:bg-hover">All off</button>
      </div>
      <div className="overflow-x-auto">
        <table className="table-fixed w-full min-w-[860px] border-collapse text-[12px]">
          <thead>
            <tr className="border-y border-line">
              <th className={`eyebrow text-left px-3 py-2 w-[200px] border-r-2 border-ink ${STICKY_L}`}>On · deal</th>
              {FUTURE.map((w) => <th key={w} className={`px-0.5 py-2 ${COL}`}><WeekHead w={w} /></th>)}
              <th className={`eyebrow px-1 w-[68px] border-l border-line ${STICKY_R}`}>Shift</th>
            </tr>
          </thead>
          <tbody>
            {pipeline.map((p) => {
              const on = !!scenario?.projects[p.projectId]?.on;
              const start = starts[p.projectId] ?? p.startDate;
              const end = projectLastWeek(p, start);
              const label = p.demand.map((l) => `${l.stack} ${l.fte} FTE${l.email ? ` (${nameOf(l.email)})` : ''}`).join(', ');
              const firstIdx = FUTURE.findIndex((w) => w >= start && w <= end);
              return (
                <tr key={p.projectId} className="border-b border-line">
                  <td className={`px-3 py-2 border-r-2 border-ink ${STICKY_L}`}>
                    <label className="flex items-center gap-2 cursor-pointer min-w-0">
                      <input type="checkbox" role="switch" aria-label={`Switch ${p.name}`} checked={on}
                        onChange={(e) => setScenario(setProjectOn(scenario, p.projectId, e.target.checked))}
                        className="appearance-none w-8 h-[18px] rounded-full bg-input checked:bg-navy relative cursor-pointer shrink-0
                          before:content-[''] before:absolute before:top-[2px] before:left-[2px] before:w-[14px] before:h-[14px] before:rounded-full before:bg-white before:transition-all checked:before:left-[16px]" />
                      <span className="min-w-0" title={p.name}>
                        <span className="font-semibold block truncate">{p.name}</span>
                        <span className="text-[11px] text-ink2 block truncate">{p.client} · {p.winChancePct == null ? 'win chance not set' : `${p.winChancePct}% win`}</span>
                      </span>
                    </label>
                  </td>
                  {FUTURE.map((w, i) => {
                    const inBar = w >= start && w <= end;
                    if (!inBar) return <td key={w} className={COL} />;
                    const first = i === firstIdx;
                    return (
                      <td key={w} className={`${COL} py-2 px-0`}>
                        <div title={label} className={`relative h-7 flex items-center overflow-visible whitespace-nowrap text-[11px] border-y
                          ${first ? 'border-l rounded-l pl-2 ml-0.5' : ''} ${w === end ? 'border-r rounded-r mr-0.5' : ''}
                          ${on ? 'bg-amber-t2 border-amber text-amber-text border-solid' : 'bg-white border-amber border-dashed text-amber-text'}`}>
                          {first ? <span className="absolute left-2 z-10 whitespace-nowrap">{label}</span> : null}
                        </div>
                      </td>
                    );
                  })}
                  <td className={`px-1 text-center whitespace-nowrap border-l border-line ${STICKY_R}`}>
                    <button aria-label={`Shift ${p.name} earlier`} onClick={() => setScenario(shiftProject(scenario, p.projectId, -1))}
                      className="border border-input rounded w-6 h-6 hover:bg-hover">−</button>{' '}
                    <button aria-label={`Shift ${p.name} later`} onClick={() => setScenario(shiftProject(scenario, p.projectId, 1))}
                      className="border border-input rounded w-6 h-6 hover:bg-hover">+</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 mr-3 cursor-pointer">
          <input type="checkbox" checked={!!scenario?.alignStarts} onChange={(e) => setScenario(setAlignStarts(scenario, e.target.checked))} />
          Align starts
        </label>
        {impact?.newlyOver.map((o) => (
          <span key={o.email} className="rounded-full bg-amber-t1 border border-amber-t4 text-amber-text px-2.5 py-0.5 text-[12px]">
            {o.name} over 100% from {shortDate(o.firstWeek)}, peak <span className="font-mono">{o.peakPct}%</span>
          </span>
        ))}
        {impact?.stackChanges.map((s) => (
          <span key={s.stack} className="rounded-full bg-amber-t1 border border-amber-t4 text-amber-text px-2.5 py-0.5 text-[12px]">
            {s.change === 'larger'
              ? <>{stackLabel(model, s.stack)} gap grows <span className="font-mono">{s.baselinePeakFte} → {s.peakFte}</span> FTE</>
              : <>{stackLabel(model, s.stack)} new gap <span className="font-mono">{s.peakFte}</span> FTE</>}
          </span>
        ))}
      </div>
    </section>
  );
}

function PeopleGrid() {
  const { model, scenario, editCount, reset } = useModel();
  const [showPast, setShowPast] = useState(true);
  const [sel, setSel] = useState<{ email: string; w: Week } | null>(null);
  const past = showPast ? PAST : [];

  const groups = useMemo(() => {
    const stacks = [...model.allStacks, null];
    return stacks.map((s) => {
      const people = model.people.filter((p) => p.mainStack === s).sort((a, b) => a.name.localeCompare(b.name, 'hu'));
      const demand = s ? FUTURE.map((w) => demandFte(model, s, w, scenario)) : [];
      return { stack: s, people, demand, hasDemand: demand.some((d) => d > 0) };
    }).filter((g) => g.people.length || g.hasDemand);
  }, [model, scenario]);

  const colCount = 1 + past.length + FUTURE.length;

  return (
    <section className="card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3">
        <h2 className="text-[14px] font-semibold">People</h2>
        <label className="flex items-center gap-2 text-[12px] cursor-pointer">
          <input type="checkbox" checked={showPast} onChange={(e) => setShowPast(e.target.checked)} /> Show last 5 weeks (actuals)
        </label>
      </div>
      <div className="overflow-x-auto">
        <table className="table-fixed w-full border-collapse text-[12px]" style={{ minWidth: 170 + (past.length + FUTURE.length) * 51 }}>
          <thead>
            <tr className="border-y border-line">
              <th className={`eyebrow text-left px-3 py-2 w-[170px] border-r border-line ${STICKY_L}`}>Person</th>
              {past.map((w) => <th key={w} className={`px-0.5 py-2 ${COL}`}><WeekHead w={w} actual /></th>)}
              {FUTURE.map((w) => <th key={w} className={`px-0.5 py-2 ${COL} ${w === TODAY ? 'border-l-2 border-l-ink' : ''}`}><WeekHead w={w} /></th>)}
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <Group key={g.stack ?? 'none'} g={g} past={past} colCount={colCount} onCell={(email, w) => setSel({ email, w })} />
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center gap-4 px-4 py-3 border-t border-line text-[11px] text-ink2">
        <span className="flex items-center gap-1.5"><i className="w-4 h-3 bg-amber-t3 inline-block rounded-sm" /> Over 100%</span>
        <span className="flex items-center gap-1.5"><i className="w-4 h-3 bg-navy-t1 inline-block rounded-sm" /> 51–100%</span>
        <span className="flex items-center gap-1.5"><i className="w-4 h-3 border border-dashed border-hint inline-block rounded-sm" /> Idle, 50% or less</span>
        <span className="flex items-center gap-1.5"><i className="w-4 h-3 hatch inline-block rounded-sm" /> Planned while away</span>
        <span className="flex items-center gap-1.5"><i className="w-1.5 h-1.5 bg-ink rounded-full inline-block" /> Manual edit</span>
        <span className="ml-auto">Manual edits: <b className="font-mono text-ink">{editCount}</b></span>
        <button onClick={reset} className="border border-input rounded px-2.5 py-1 text-[12px] text-ink hover:bg-hover">Reset Admin and Plan edits</button>
      </div>
      {sel && <PersonPanel email={sel.email} w={sel.w} onClose={() => setSel(null)} />}
    </section>
  );
}

function Group({ g, past, colCount, onCell }: {
  g: { stack: string | null; people: Person[]; demand: number[]; hasDemand: boolean };
  past: Week[]; colCount: number; onCell: (email: string, w: Week) => void;
}) {
  const { model } = useModel();
  const label = g.stack ? stackLabel(model, g.stack).toUpperCase() : 'NO MAIN STACK';
  return (
    <>
      <tr className="bg-page border-b border-line">
        <td colSpan={colCount} className="eyebrow px-3 py-1.5"><span className="sticky left-3">{label} · {g.people.length} (main stack)</span></td>
      </tr>
      {g.people.map((p) => (
        <tr key={p.email} className="border-b border-line">
          <td className={`px-3 py-1.5 border-r border-line ${STICKY_L}`} title={p.name}>
            <div className="font-semibold truncate">{p.name}</div>
            <div className="text-[11px] text-ink2 truncate">
              {p.weeklyHours} h/wk · {[p.mainStack, ...p.stacks.filter((s) => s !== p.mainStack)].filter(Boolean).join(', ')}
            </div>
          </td>
          {past.map((w) => <PastCell key={w} p={p} w={w} onClick={() => onCell(p.email, w)} />)}
          {FUTURE.map((w) => <FutureCell key={w} p={p} w={w} onClick={() => onCell(p.email, w)} />)}
        </tr>
      ))}
      {g.hasDemand && g.stack && (
        <tr className="border-b border-line bg-amber-t1/40">
          <td className="px-3 py-1.5 border-r border-line text-amber-text font-semibold sticky left-0 z-20 bg-amber-t1 truncate">Unstaffed · {g.stack}</td>
          {past.map((w) => <td key={w} />)}
          {FUTURE.map((w, i) => (
            <td key={w} className={`text-center font-mono text-amber-text ${w === TODAY ? 'border-l-2 border-l-ink' : ''}`}>
              {g.demand[i] > 0 ? `${g.demand[i]} FTE` : ''}
            </td>
          ))}
        </tr>
      )}
    </>
  );
}

function PastCell({ p, w, onClick }: { p: Person; w: Week; onClick: () => void }) {
  const { model } = useModel();
  if (!employedDates(p, w).length) {
    return <td onClick={onClick} className={`${COL} hatch text-center text-hint cursor-pointer`}>–</td>;
  }
  const a = actualHours(model, p.email, w);
  const d = driftHours(model, p.email, w);
  return (
    <td onClick={onClick} className={`${COL} text-center font-mono leading-tight cursor-pointer hover:bg-hover`}>
      <div>{r1(a)}h</div>
      <div className="text-[10px] text-ink2">{d == null ? '' : fmtSigned(r1(d))}</div>
    </td>
  );
}

function FutureCell({ p, w, onClick }: { p: Person; w: Week; onClick: () => void }) {
  const { model, scenario } = useModel();
  const ld = loadPct(model, p.email, w, scenario);
  const off = absenceDays(p, w);
  const manual = allocationRows(model, p.email, w).some((r) => r.source === 'manual');
  const { overloadPct, idlePct } = model.settings;
  const today = w === TODAY ? 'border-l-2 border-l-ink' : '';
  let body: React.ReactNode;
  let cls = '';
  if (ld === 'away') {
    const planned = plannedRows(model, p.email, w, scenario).reduce((t, r) => t + r.hours, 0);
    cls = 'hatch text-amber-text';
    body = <><div className="font-semibold">away</div><div className="text-[10px]">{r1(planned)}h plan</div></>;
  } else if (ld == null) {
    const left = p.end != null && w > p.end;
    cls = 'text-hint-2';
    body = <div className="text-[10px]">{left ? 'left' : 'not started'}</div>;
  } else {
    cls = ld > overloadPct ? 'bg-amber-t3 text-amber-text' : ld <= idlePct ? 'text-ink2' : 'bg-navy-t1 text-navy';
    body = (
      <div className={ld <= idlePct ? 'border border-dashed border-hint rounded mx-1 py-1' : ''}>
        {r1(ld)}%{off > 0 && <div className="text-[10px]">{off}d off</div>}
      </div>
    );
  }
  return (
    <td onClick={onClick} className={`${COL} ${today} ${cls} relative text-center font-mono leading-tight cursor-pointer hover:brightness-95 py-1.5`}
      aria-label={`${p.name} ${w}`}>
      {manual && <span title="Manual edit" className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-ink" />}
      {body}
    </td>
  );
}

function PersonPanel({ email, w, onClose }: { email: string; w: Week; onClose: () => void }) {
  const { model, scenario, applyOp } = useModel();
  const p = model.personByEmail.get(email)!;
  const isFuture = w >= TODAY;
  const name = (id: string) => model.projectById.get(id)?.name ?? id;
  const editable = model.projects.filter((x) => x.type !== 'pipeline');
  const rows = isFuture ? plannedRows(model, email, w, scenario) : [];
  const ld = isFuture ? loadPct(model, email, w, scenario) : null;
  const [form, setForm] = useState({ projectId: editable[0]?.projectId ?? '', hours: '0', from: w, to: FUTURE[FUTURE.length - 1] });

  return (
    <SidePanel title={`${p.name} · week of ${shortDate(w)}`} onClose={onClose}>
      <p className="font-mono text-[11px] bg-page rounded p-2 mb-4">{availabilityFormula(model, email, w)}</p>
      {isFuture ? (
        <>
          <div className="eyebrow mb-2">Planned hours by project</div>
          <table className="w-full text-[12px] mb-2">
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b border-line">
                  <td className="py-1.5">{name(r.projectId)} <span className="ml-1 text-[10px] rounded bg-hover px-1.5 py-0.5 text-ink2">{r.source}</span></td>
                  <td className="font-mono text-right">{r1(r.hours)} h</td>
                </tr>
              ))}
              {!rows.length && <tr><td className="py-1.5 text-hint-2">Nothing planned.</td></tr>}
            </tbody>
          </table>
          <p className="text-[12px] mb-5">Load: <b className="font-mono">{typeof ld === 'number' ? `${r1(ld)}%` : ld ?? '—'}</b></p>
          <form className="space-y-2 text-[12px] border-t border-line pt-4" onSubmit={(e) => {
            e.preventDefault();
            applyOp({ op: 'setAllocation', email, projectId: form.projectId, hoursPerWeek: Number(form.hours), fromWeek: form.from, toWeek: form.to });
          }}>
            <div className="eyebrow">Change hours</div>
            <label className="block">Project
              <select aria-label="Project" value={form.projectId} onChange={(e) => setForm({ ...form, projectId: e.target.value })}
                className="block w-full border border-input rounded px-2 py-1 mt-0.5">
                {editable.map((x) => <option key={x.projectId} value={x.projectId}>{x.name}</option>)}
              </select>
            </label>
            <label className="block">Hours per week
              <input aria-label="Hours per week" type="number" min={0} step={1} value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })}
                className="block w-full border border-input rounded px-2 py-1 mt-0.5 font-mono" />
            </label>
            <div className="flex gap-2">
              {(['from', 'to'] as const).map((k) => (
                <label key={k} className="flex-1">{k === 'from' ? 'From week' : 'To week'}
                  <select aria-label={k === 'from' ? 'From week' : 'To week'} value={form[k]} onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    className="block w-full border border-input rounded px-2 py-1 mt-0.5">
                    {FUTURE.map((x) => <option key={x} value={x}>{shortDate(x)}</option>)}
                  </select>
                </label>
              ))}
            </div>
            <button type="submit" className="bg-navy hover:bg-navy-dark text-white rounded px-3 py-1.5">Save hours</button>
          </form>
        </>
      ) : (
        <PastRows email={email} w={w} name={name} />
      )}
    </SidePanel>
  );
}

function PastRows({ email, w, name }: { email: string; w: Week; name: (id: string) => string }) {
  const { model } = useModel();
  const plan = allocationRows(model, email, w);
  const act = actualRows(model, email, w);
  const ids = [...new Set([...plan.map((r) => r.projectId), ...act.map((r) => r.projectId)])];
  return (
    <table className="w-full text-[12px]">
      <thead><tr className="eyebrow text-left"><th className="py-1">Project</th><th className="text-right">Plan</th><th className="text-right">Actual</th></tr></thead>
      <tbody>
        {ids.map((id) => {
          const pr = plan.filter((r) => r.projectId === id);
          const ar = act.find((r) => r.projectId === id);
          return (
            <tr key={id} className="border-b border-line">
              <td className="py-1.5">{name(id)} {pr.map((r, i) => <span key={i} className="ml-1 text-[10px] rounded bg-hover px-1.5 py-0.5 text-ink2">{r.source}</span>)}</td>
              <td className="font-mono text-right">{pr.length ? pr.map((r) => `${r1(r.hours)} h`).join(' + ') : '—'}</td>
              <td className="font-mono text-right">{ar ? `${r1(ar.hours)} h` : '—'}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
