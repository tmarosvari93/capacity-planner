import { useState, type FormEvent } from 'react';
import { stackLabel, type Person } from '@/core';
import { useModel } from '@/state/ModelContext';
import { SidePanel } from './SidePanel';
import { AdminButton, AdminField, adminInput } from './AdminControls';

function PersonEditor({ person, onClose }: { person: Person; onClose: () => void }) {
  const { model, applyOp } = useModel();
  const [stacks, setStacks] = useState(person.stacks), [main, setMain] = useState(person.mainStack ?? '');
  const [cost, setCost] = useState(String(person.costPerHour ?? '')), [error, setError] = useState('');
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (cost !== '' && (!Number.isFinite(Number(cost)) || Number(cost) < 0)) { setError('Cost per hour must be non-negative.'); return; }
    applyOp({ op: 'editPerson', email: person.email, patch: { stacks: main ? [main, ...stacks.filter(s => s !== main)] : stacks, mainStack: main, costPerHour: cost === '' ? null : Number(cost) } });
    onClose();
  };
  return <SidePanel title={`Edit ${person.name}`} onClose={onClose}><form onSubmit={submit} className="space-y-4">
    <p className="text-muted">{person.title} · {person.weeklyHours} h/week · HR</p>
    <fieldset><legend className="font-semibold mb-2 text-[12px]">Stacks</legend><div className="grid grid-cols-2 gap-2">{model.allStacks.map(stack => <label key={stack} className="flex items-center gap-2 text-[12px]"><input type="checkbox" checked={stacks.includes(stack)} onChange={e => { setStacks(e.target.checked ? [...stacks, stack] : stacks.filter(s => s !== stack)); if (!e.target.checked && main === stack) setMain(''); }} />{stackLabel(model, stack)}</label>)}</div></fieldset>
    <AdminField label="Main stack"><select className={adminInput} value={main} onChange={e => setMain(e.target.value)}><option value="">Not set</option>{stacks.map(stack => <option key={stack} value={stack}>{stackLabel(model, stack)}</option>)}</select></AdminField>
    <AdminField label="Cost per hour (EUR), optional"><input type="number" min="0" step="0.01" className={adminInput} value={cost} onChange={e => setCost(e.target.value)} /></AdminField>
    {error && <p role="alert" className="text-amber-text">{error}</p>}<AdminButton primary type="submit">Save person</AdminButton>
  </form></SidePanel>;
}

export function AdminPeople() {
  const { model } = useModel();
  const [selected, setSelected] = useState<string>();
  const person = selected ? model.personByEmail.get(selected) : undefined;
  const unknownAccounts = [...new Set(model.issues.filter(issue => issue.rule === 'F1').map(issue => String(issue.row)))];
  return <div className="space-y-6">
    <section><h2 className="font-semibold text-[14px] mb-3">People</h2><div className="overflow-x-auto"><table className="w-full text-[12px] text-left">
      <thead className="border-b border-line text-ink2"><tr>{['Person', 'HR title', 'h/week · HR', 'Stacks · main first', 'Cost/h', ''].map(label => <th key={label} className="py-2 px-2 font-semibold whitespace-nowrap">{label}</th>)}</tr></thead>
      <tbody>{model.people.map(person => <tr key={person.email} className="border-b border-line"><td className="py-3 px-2 min-w-[125px]">{person.name}</td><td className="px-2">{person.title}</td><td className="px-2 font-mono">{person.weeklyHours}</td><td className="px-2"><div className="flex flex-wrap gap-1">{[...(person.mainStack ? [person.mainStack] : []), ...person.stacks.filter(stack => stack !== person.mainStack)].map(stack => <span key={stack} className={`rounded px-1.5 py-0.5 text-[11px] ${stack === person.mainStack ? 'bg-navy text-page' : 'bg-hover text-ink2'}`}>{stack}</span>)}</div></td><td className="px-2 font-mono whitespace-nowrap">{person.costPerHour == null ? 'not set' : `€${person.costPerHour}`}</td><td className="px-2"><AdminButton aria-label={`Edit ${person.name}`} onClick={() => setSelected(person.email)}>Edit</AdminButton></td></tr>)}</tbody>
    </table></div></section>
    <section className="border-t border-line pt-5"><h2 className="font-semibold text-[14px] mb-3">Jira account → person</h2><div className="overflow-x-auto"><table className="w-full text-[12px] text-left"><thead className="border-b border-line text-ink2"><tr><th className="py-2 font-semibold">Jira account</th><th className="font-semibold">Person</th><th className="font-semibold">Status</th></tr></thead><tbody>
      {[...model.accountMap].map(([account, email]) => <tr key={account} className="border-b border-line"><td className="py-2 font-mono pr-3">{account}</td><td className="pr-3">{model.personByEmail.get(email)?.name ?? email}</td><td>Mapped</td></tr>)}
      {unknownAccounts.map(account => <tr key={account} className="bg-amber-t1 border-b border-line"><td className="py-2 font-mono pr-3">{account}</td><td>Unmapped person</td><td className="text-amber-text">Unmapped · hours stay on project</td></tr>)}
    </tbody></table></div></section>
    {person && <PersonEditor key={person.email} person={person} onClose={() => setSelected(undefined)} />}
  </div>;
}