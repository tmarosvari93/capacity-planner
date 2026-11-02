import { useState, type FormEvent } from 'react';
import { FUTURE, addWeeks, daysBetween, projectFromForm, projectLastWeek, shortDate, stackLabel, type Project } from '@/core';
import { useModel } from '@/state/ModelContext';
import { SidePanel } from './SidePanel';
import { AdminButton, AdminField, AdminWeekSelect, adminInput } from './AdminControls';

export function AdminProjectPanel({ project, onClose }: { project: Project; onClose: () => void }) {
  const { model, applyOp } = useModel();
  const [name, setName] = useState(project.name), [client, setClient] = useState(project.client);
  const [win, setWin] = useState(String(project.winChancePct ?? ''));
  const [start, setStart] = useState(project.startDate), [duration, setDuration] = useState(String(project.durationWeeks ?? 4));
  const [signedStart, setSignedStart] = useState('');
  const [stack, setStack] = useState(model.allStacks[0] ?? ''), [fte, setFte] = useState('1');
  const [from, setFrom] = useState(''), [to, setTo] = useState(''), [demandPerson, setDemandPerson] = useState('');
  const [email, setEmail] = useState(model.people[0]?.email ?? ''), [hours, setHours] = useState('40');
  const [allocFrom, setAllocFrom] = useState(FUTURE[0]), [allocTo, setAllocTo] = useState(FUTURE[FUTURE.length - 1]);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const saveProject = (event: FormEvent) => {
    event.preventDefault();
    const result = projectFromForm(model, { type: 'pipeline', name, client, winChancePct: win, startWeek: start, durationWeeks: duration, lines: [{ stack: model.allStacks[0] ?? '', fte: 1 }] });
    if ('error' in result) { setError(result.error); return; }
    const shift = daysBetween(project.startDate, start);
    const last = addWeeks(start, Number(duration) - 1);
    const demand = project.demand.map(line => ({ ...line,
      fromWeek: line.fromWeek ? (addWeeks(line.fromWeek, shift / 7) > last ? last : addWeeks(line.fromWeek, shift / 7)) : null,
      toWeek: line.toWeek ? (addWeeks(line.toWeek, shift / 7) > last ? last : addWeeks(line.toWeek, shift / 7)) : null,
    }));
    applyOp({ op: 'editProject', projectId: project.projectId, patch: { name: result.project.name, client: result.project.client, winChancePct: result.project.winChancePct, startDate: start, durationWeeks: Number(duration), demand } });
    setError(''); setMessage('Project saved.');
  };
  const addDemand = (event: FormEvent) => {
    event.preventDefault();
    if (!(Number.isFinite(Number(fte)) && Number(fte) > 0)) { setError('FTE must be above 0.'); return; }
    if (from && to && to < from) { setError('To week must be on or after From week.'); return; }
    applyOp({ op: 'addDemandLine', projectId: project.projectId, line: { stack, fte: Number(fte), fromWeek: from || null, toWeek: to || null, email: demandPerson || null } });
    setError(''); setMessage('Demand line added.');
  };
  const allocate = (event: FormEvent) => {
    event.preventDefault();
    if (!email || !Number.isFinite(Number(hours)) || Number(hours) < 0) { setError('Choose a person and non-negative weekly hours.'); return; }
    if (allocTo < allocFrom) { setError('To week must be on or after From week.'); return; }
    applyOp({ op: 'setAllocation', projectId: project.projectId, email, hoursPerWeek: Number(hours), fromWeek: allocFrom, toWeek: allocTo });
    setError(''); setMessage('Allocation saved.');
  };
  const pipeline = project.type === 'pipeline';
  return <SidePanel title={project.name} onClose={onClose}>
    <div className="text-[12px] text-muted mb-4">{project.projectId} · {pipeline ? 'Pipeline' : project.type === 'signed' ? 'Signed' : 'Internal'} · {project.client}</div>
    {error && <p role="alert" className="text-amber-text mb-3">{error}</p>}{message && <p role="status" className="text-navy mb-3">{message}</p>}
    {pipeline && <>
      <form onSubmit={saveProject} className="space-y-3">
        <AdminField label="Project name"><input className={adminInput} value={name} onChange={e => setName(e.target.value)} /></AdminField>
        <AdminField label="Client"><input className={adminInput} value={client} onChange={e => setClient(e.target.value)} /></AdminField>
        <AdminField label="Win chance (%), optional"><input className={adminInput} type="number" min="0" max="100" value={win} onChange={e => setWin(e.target.value)} /></AdminField>
        <div className="grid grid-cols-2 gap-2"><AdminField label="Start week"><AdminWeekSelect extraWeek={project.startDate} value={start} onChange={e => setStart(e.target.value)} /></AdminField><AdminField label="Duration (weeks)"><input className={adminInput} type="number" min="1" max="26" value={duration} onChange={e => setDuration(e.target.value)} /></AdminField></div>
        <AdminButton primary type="submit">Save project</AdminButton>
      </form>
      <div className="border-y border-line py-4 my-4 space-y-3"><AdminField label="New signed start week (optional)"><AdminWeekSelect emptyLabel="Keep project start" value={signedStart} onChange={e => setSignedStart(e.target.value)} /></AdminField>
        <AdminButton onClick={() => { applyOp({ op: 'markSigned', projectId: project.projectId, ...(signedStart ? { startDate: signedStart } : {}) }); setMessage('Project marked as signed.'); setError(''); }}>Mark as signed</AdminButton>
      </div>
    </>}
    {!pipeline && <form onSubmit={allocate} className="space-y-3 border-b border-line pb-4 mb-4">
      <h3 className="font-semibold">Assign a person</h3>
      <AdminField label="Person"><select className={adminInput} value={email} onChange={e => setEmail(e.target.value)}>{model.people.map(person => <option key={person.email} value={person.email}>{person.name}</option>)}</select></AdminField>
      <AdminField label="Hours per week"><input className={adminInput} type="number" min="0" step="0.5" value={hours} onChange={e => setHours(e.target.value)} /></AdminField>
      <div className="grid grid-cols-2 gap-2"><AdminField label="Allocation from"><AdminWeekSelect value={allocFrom} onChange={e => setAllocFrom(e.target.value)} /></AdminField><AdminField label="Allocation to"><AdminWeekSelect value={allocTo} onChange={e => setAllocTo(e.target.value)} /></AdminField></div>
      <AdminButton primary type="submit">Save allocation</AdminButton>
    </form>}
    <h3 className="font-semibold mb-2">Demand lines</h3>
    <ul className="text-[12px] space-y-2 mb-4">{project.demand.map((line, i) => <li key={i}>{stackLabel(model, line.stack)} · {line.fte} FTE{line.email && ` · ${model.personByEmail.get(line.email)?.name ?? line.email}`}<div className="text-muted text-[11px]">{shortDate(line.fromWeek ?? project.startDate)} → {shortDate(line.toWeek ?? projectLastWeek(project))}</div></li>)}{!project.demand.length && <li className="text-muted">No unstaffed demand</li>}</ul>
    <form onSubmit={addDemand} className="space-y-3 border-t border-line pt-4">
      <h3 className="font-semibold">Add a demand line</h3>
      <AdminField label="Demand stack"><select className={adminInput} value={stack} onChange={e => setStack(e.target.value)}>{model.allStacks.map(s => <option key={s} value={s}>{stackLabel(model, s)}</option>)}</select></AdminField>
      <AdminField label="Demand FTE"><input className={adminInput} type="number" min="0.01" step="0.05" value={fte} onChange={e => setFte(e.target.value)} /></AdminField>
      {pipeline && <AdminField label="Named person (optional)"><select className={adminInput} value={demandPerson} onChange={e => setDemandPerson(e.target.value)}><option value="">Unstaffed</option>{model.people.map(p => <option key={p.email} value={p.email}>{p.name}</option>)}</select></AdminField>}
      <div className="grid grid-cols-2 gap-2"><AdminField label="Demand from"><AdminWeekSelect emptyLabel="project start" value={from} onChange={e => setFrom(e.target.value)} /></AdminField><AdminField label="Demand to"><AdminWeekSelect emptyLabel="project end" value={to} onChange={e => setTo(e.target.value)} /></AdminField></div>
      <AdminButton type="submit">Add demand line</AdminButton>
    </form>
  </SidePanel>;
}