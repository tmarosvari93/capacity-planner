import { useState } from 'react';
import { dataIssues, resolveScenario, setProjectOn, shortDate, stackLabel } from '@/core';
import { useModel } from '@/state/ModelContext';
import { AdminButton, adminInput } from '@/components/AdminControls';
import { AdminProjectForm } from '@/components/AdminProjectForm';
import { AdminProjectPanel } from '@/components/AdminProjectPanel';
import { AdminPeople } from '@/components/AdminPeople';

function Projects() {
  const { model, scenario, setScenario, applyOp } = useModel();
  const [selected, setSelected] = useState<string>();
  const starts = resolveScenario(model, scenario);
  const project = selected ? model.projectById.get(selected) : undefined;
  const unmapped = [...new Set(dataIssues(model).filter(issue => issue.rule === 'F2').map(issue => String(issue.row)))];
  return <div className="space-y-6">
    <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_320px] gap-5 items-start">
      <section className="min-w-0"><h2 className="text-[14px] font-semibold mb-3">Projects</h2><div className="overflow-x-auto"><table className="w-full text-[11px] text-left">
        <thead className="border-b border-line text-ink2"><tr>{['Project', 'Type', 'Win chance', 'When', 'Unstaffed demand', 'Scenario', ''].map(label => <th key={label} className="font-semibold py-2 px-2 whitespace-nowrap">{label}</th>)}</tr></thead>
        <tbody>{model.projects.map(project => <tr key={project.projectId} className="border-b border-line align-top">
          <td className="py-3 px-2 min-w-[120px]"><div className="font-semibold">{project.name}</div><div className="text-muted mt-0.5">{project.client}</div><div className="font-mono text-muted text-[10px]">{project.projectId}</div></td>
          <td className="py-3 px-2"><span className={`rounded px-1.5 py-0.5 whitespace-nowrap font-semibold ${project.type === 'signed' ? 'bg-navy-t1 text-navy' : project.type === 'pipeline' ? 'bg-amber-t1 text-amber-text' : 'bg-hover text-ink2'}`}>{project.type === 'signed' ? `Signed${project.origin === 'jira' ? ' · from Jira' : ''}` : project.type === 'pipeline' ? 'Pipeline' : 'Internal'}</span></td>
          <td className="py-3 px-2 font-mono whitespace-nowrap">{project.type === 'pipeline' ? project.winChancePct == null ? 'not set' : `${project.winChancePct}%` : '—'}</td>
          <td className="py-3 px-2 min-w-[130px]">{project.type === 'pipeline' ? `${shortDate(project.startDate)} · ${project.durationWeeks} wks` : `since ${shortDate(project.startDate)} → ${project.endDate ? shortDate(project.endDate) : 'ongoing'}`}</td>
          <td className="py-3 px-2 min-w-[160px] space-y-1">{project.demand.length ? project.demand.map((line, i) => <div key={i}>{stackLabel(model, line.stack)} <span className="font-mono">{line.fte} FTE</span>{line.email && ` · ${model.personByEmail.get(line.email)?.name ?? line.email}`}</div>) : '—'}</td>
          <td className="py-3 px-2">{project.type === 'pipeline' ? <label className="flex items-center gap-1.5 whitespace-nowrap"><input aria-label={`${project.name} scenario`} type="checkbox" checked={Boolean(starts[project.projectId])} onChange={e => setScenario(setProjectOn(scenario, project.projectId, e.target.checked))} />{starts[project.projectId] ? 'on' : 'off'}</label> : <span className="whitespace-nowrap">always in</span>}</td>
          <td className="py-3 px-2"><AdminButton aria-label={`${project.type === 'pipeline' ? 'Edit' : 'View'} ${project.name}`} onClick={() => setSelected(project.projectId)}>{project.type === 'pipeline' ? 'Edit' : 'View'}</AdminButton></td>
        </tr>)}</tbody>
      </table></div></section>
      <AdminProjectForm />
    </div>
    <section className="border-t border-line pt-5"><h2 className="text-[14px] font-semibold mb-3">Jira project → project</h2><div className="overflow-x-auto"><table className="w-full text-[12px] text-left">
      <thead className="border-b border-line text-ink2"><tr>{['Jira key', 'Project', 'Type', 'Start', 'End'].map(label => <th key={label} className="py-2 px-2 font-semibold">{label}</th>)}</tr></thead>
      <tbody>{[...model.keyMap].map(([key, id]) => { const p = model.projectById.get(id); return <tr key={key} className="border-b border-line"><td className="py-2 px-2 font-mono">{key}</td><td className="px-2">{p?.name ?? id}</td><td className="px-2">{p?.type === 'signed' ? 'Signed' : p?.type === 'pipeline' ? 'Pipeline' : 'Internal'}</td><td className="px-2">{p ? shortDate(p.startDate) : '—'}</td><td className="px-2">{p?.endDate ? shortDate(p.endDate) : 'ongoing'}</td></tr>; })}
        {unmapped.map(key => <tr key={key} className="bg-amber-t1 border-b border-line"><td className="py-3 px-2 font-mono">{key}</td><td colSpan={4} className="py-3 px-2"><select className={`${adminInput} max-w-sm`} aria-label={`Map ${key} to project`} value="" onChange={e => { if (e.target.value) applyOp({ op: 'mapJiraKey', jiraProjectKey: key, projectId: e.target.value }); }}><option value="">Unmapped · choose project</option>{model.projects.map(p => <option key={p.projectId} value={p.projectId}>{p.name}</option>)}</select><div className="text-[11px] text-amber-text mt-1">{model.worklogs.filter(log => log.projectKey === key && !log.projectId).reduce((sum, log) => sum + log.hours, 0)} h counted as non-billable until converted</div></td></tr>)}
      </tbody>
    </table></div></section>
    {project && <AdminProjectPanel key={project.projectId} project={project} onClose={() => setSelected(undefined)} />}
  </div>;
}

export default function Admin() {
  const { model } = useModel();
  const [tab, setTab] = useState('Projects');
  const settings = model.settings;
  return <div className="space-y-5">
    <header><div className="eyebrow">What HR and Jira do not hold</div><h1 className="text-[22px] font-semibold">Admin</h1></header>
    <div role="tablist" aria-label="Admin sections" className="flex gap-1 border-b border-line">{['Projects', 'People', 'Settings'].map(label => <AdminButton key={label} role="tab" id={`admin-tab-${label}`} aria-controls={`admin-panel-${label}`} aria-selected={tab === label} className={`border-0 rounded-none px-3 py-2 ${tab === label ? 'border-b-2 border-navy text-navy bg-hover' : 'text-muted'}`} onClick={() => setTab(label)}>{label}</AdminButton>)}</div>
    <div role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`}>
      {tab === 'Projects' ? <Projects /> : tab === 'People' ? <AdminPeople /> : <section className="max-w-2xl"><h2 className="font-semibold text-[14px] mb-4">Settings</h2><dl className="text-[13px] divide-y divide-line">
        {[
          ['Overload', `Above ${settings.overloadPct}%`], ['Idle', `At or below ${settings.idlePct}%`], ['Available', `From ${settings.availableMinHours} h free`],
          ['Billable target', `${settings.billableTargetPct}%`], ['Spare shown', `From ${settings.spareMinFte} FTE`],
        ].map(([label, value]) => <div key={label} className="flex justify-between gap-4 py-3"><dt className="text-muted">{label}</dt><dd className="font-mono">{value}</dd></div>)}
      </dl></section>}
    </div>
  </div>;
}