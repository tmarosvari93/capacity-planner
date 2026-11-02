import { useState, type FormEvent } from 'react';
import { FUTURE, addWeeks, projectFromForm, setProjectOn, shortDate, stackLabel, type ProjectForm, type ProjectType } from '@/core';
import { useModel } from '@/state/ModelContext';
import { AdminButton, AdminField, AdminWeekSelect, adminInput } from './AdminControls';

export function AdminProjectForm() {
  const { model, scenario, applyOp, setScenario } = useModel();
  const initial = (): ProjectForm => ({ type: 'pipeline', name: '', client: '', winChancePct: '', startWeek: FUTURE[0], durationWeeks: 4, lines: [{ stack: model.allStacks[0] ?? '', fte: 1, fromOffset: '', toOffset: '' }] });
  const [form, setForm] = useState<ProjectForm>(initial);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const update = (patch: Partial<ProjectForm>) => setForm(current => ({ ...current, ...patch }));
  const lineUpdate = (index: number, patch: Partial<ProjectForm['lines'][number]>) => update({ lines: form.lines.map((line, i) => i === index ? { ...line, ...patch } : line) });
  const duration = Math.max(1, Math.min(26, Number(form.durationWeeks) || 1));
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = projectFromForm(model, form);
    if ('error' in result) { setError(result.error); setMessage(''); return; }
    applyOp({ op: 'addProject', project: result.project });
    if (result.project.type === 'pipeline') setScenario(setProjectOn(scenario, result.project.projectId, true));
    setMessage(`${result.project.name} added · ${result.project.projectId}`); setError(''); setForm(initial());
  };
  return <form onSubmit={submit} noValidate className="bg-hover rounded-lg p-4 space-y-3" aria-label="Add a project">
    <h2 className="font-semibold text-[14px]">Add a project</h2>
    <AdminField label="Type"><select className={adminInput} value={form.type} onChange={event => update({ type: event.target.value as ProjectType })}><option value="pipeline">Pipeline</option><option value="signed">Signed</option><option value="internal">Internal</option></select></AdminField>
    <AdminField label="Project name"><input className={adminInput} value={form.name} onChange={event => update({ name: event.target.value })} /></AdminField>
    <AdminField label="Client or owner"><input className={adminInput} value={form.client} onChange={event => update({ client: event.target.value })} /></AdminField>
    {form.type === 'pipeline' && <AdminField label="Win chance (%), optional"><input type="number" min="0" max="100" className={adminInput} value={form.winChancePct ?? ''} onChange={event => update({ winChancePct: event.target.value })} /></AdminField>}
    <div className="grid grid-cols-2 gap-2"><AdminField label="Start week"><AdminWeekSelect value={form.startWeek} onChange={event => update({ startWeek: event.target.value })} /></AdminField>
      <AdminField label="Duration (weeks)"><input className={adminInput} type="number" min="1" max="26" value={form.durationWeeks} onChange={event => update({ durationWeeks: event.target.value })} /></AdminField></div>
    <div className="space-y-3"><h3 className="text-[11px] font-semibold">Demand by stack (FTE)</h3>{form.lines.map((line, index) => <fieldset key={index} className="border-t border-input pt-2 space-y-2">
      <legend className="text-[11px] text-muted">Stack line {index + 1}</legend>
      <div className="grid grid-cols-[1fr_75px] gap-2"><AdminField label="Stack"><select className={adminInput} value={line.stack} onChange={event => lineUpdate(index, { stack: event.target.value })}>{model.allStacks.map(stack => <option key={stack} value={stack}>{stackLabel(model, stack)}</option>)}</select></AdminField>
        <AdminField label="FTE"><input className={adminInput} type="number" min="0" step="0.05" value={line.fte} onChange={event => lineUpdate(index, { fte: event.target.value })} /></AdminField></div>
      <div className="grid grid-cols-2 gap-2">{(['fromOffset', 'toOffset'] as const).map(key => <AdminField key={key} label={key === 'fromOffset' ? 'From' : 'To'}><select className={adminInput} value={line[key] ?? ''} onChange={event => lineUpdate(index, { [key]: event.target.value })}>
        <option value="">{key === 'fromOffset' ? 'project start' : 'project end'}</option>{Array.from({ length: duration }, (_, i) => <option key={i} value={i}>{shortDate(addWeeks(form.startWeek, i))}</option>)}
      </select></AdminField>)}</div>
      <AdminButton type="button" onClick={() => update({ lines: form.lines.filter((_, i) => i !== index) })}>Remove line {index + 1}</AdminButton>
    </fieldset>)}</div>
    <AdminButton type="button" onClick={() => update({ lines: [...form.lines, { stack: model.allStacks[0] ?? '', fte: 1, fromOffset: '', toOffset: '' }] })}>+ Add stack line</AdminButton>
    {error && <p role="alert" className="text-amber-text text-[12px]">{error}</p>}{message && <p role="status" className="text-navy text-[12px]">{message}</p>}
    <div><AdminButton primary type="submit">Add project</AdminButton></div>
  </form>;
}