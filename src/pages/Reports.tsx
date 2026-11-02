import { useMemo, type ReactNode } from 'react';
import { PAST, billableSplit, planVsActual, projectBurn } from '@/core';
import { useModel } from '@/state/ModelContext';
import { ReportDonut, ReportGauge, ReportShareBar } from '@/components/ReportCharts';

const FROM = PAST[0], TO = PAST[PAST.length - 1];
const fmt = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 2 });
const signed = (value: number) => `${value > 0 ? '+' : ''}${fmt(value)}`;
const pct = (value: number | null) => value == null ? '—' : `${fmt(value)}%`;
const heading = 'text-[14px] font-semibold';
const cell = 'py-2.5 px-2 text-right font-mono whitespace-nowrap';
const th = 'py-2 px-2 text-right font-semibold whitespace-nowrap';

function Metric({ label, value, children }: { label: string; value: ReactNode; children: ReactNode }) {
  return <section className="report-tile border border-line rounded-lg p-4 min-w-0">
    <h2 className="text-[12px] font-semibold text-ink2">{label}</h2>
    <div className="text-[22px] font-semibold my-2 font-mono break-words">{value}</div>
    <div className="text-[12px] text-muted">{children}</div>
  </section>;
}

function TypeTag({ type }: { type: string }) {
  const billable = type === 'signed';
  return <span className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${billable ? 'bg-navy-t1 text-navy' : type === 'unmapped' ? 'bg-amber-t3 text-amber-text' : 'bg-hover text-ink2'}`}>
    {billable ? 'Billable' : type === 'unmapped' ? 'Unmapped' : 'Internal'}
  </span>;
}

export default function Reports() {
  const { model } = useModel();
  const reports = useMemo(() => ({
    company: billableSplit(model, FROM, TO, 'company'),
    byPersonBill: billableSplit(model, FROM, TO, 'person'),
    byProjectBill: billableSplit(model, FROM, TO, 'project'),
    byPerson: planVsActual(model, FROM, TO, 'person'),
    byProject: planVsActual(model, FROM, TO, 'project'),
    burn: projectBurn(model, 'PRJ-ORBIT'),
  }), [model]);
  const { company, byPersonBill, byProjectBill, byPerson, byProject, burn } = reports;
  const totals = company.company;
  const largestDrift = byProject.rows.reduce<(typeof byProject.rows)[number] | undefined>((largest, row) =>
    !largest || Math.abs(row.driftHours) > Math.abs(largest.driftHours) ? row : largest, undefined);
  const personBill = new Map((byPersonBill.rows ?? []).map(row => [row.email, row]));
  const projectBill = byProjectBill.rows ?? [];
  const loggedSegments = [
    { label: 'Billable client work', hours: projectBill.filter(row => row.type === 'signed').reduce((sum, row) => sum + row.loggedHours, 0) },
    { label: 'Internal work', hours: projectBill.filter(row => row.type === 'internal').reduce((sum, row) => sum + row.loggedHours, 0) },
    { label: 'Unmapped', hours: projectBill.filter(row => row.type === 'unmapped').reduce((sum, row) => sum + row.loggedHours, 0) },
  ];
  const billableSegments = projectBill.filter(row => row.billable).map(row => ({ label: row.name as string, hours: row.loggedHours as number }));

  return <div className="space-y-5">
    <header className="flex flex-wrap items-end justify-between gap-3">
      <div><div className="eyebrow">Actuals from Jira worklogs</div><h1 className="text-[22px] font-semibold">Reports · 28 Sep – 1 Nov 2026</h1></div>
      <p className="text-[11px] text-muted">Billable = logged on a project of type Signed.</p>
    </header>

    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
      <Metric label="Billable share of logged time" value={pct(totals.shareOfLoggedPct)}>
        {fmt(totals.billableHours)} of {fmt(totals.loggedHours)} logged hours, incl. {fmt(totals.unmappedKeyHours)} h unmapped
      </Metric>
      <Metric label="Billable utilisation" value={pct(totals.utilisationPct)}>
        {fmt(totals.billableHours)} billable of {fmt(totals.availableHours)} available hours
      </Metric>
      <Metric label="Logged vs available" value={`${fmt(totals.loggedHours)} h`}>
        {fmt(totals.loggedHours)} h logged of {fmt(totals.availableHours)} h available
      </Metric>
      <Metric label="Plan vs actual · largest drift" value={largestDrift ? `${signed(largestDrift.driftHours)} h (${largestDrift.driftPct == null ? '—' : `${signed(largestDrift.driftPct)}%`})` : '—'}>
        {largestDrift?.name ?? 'No project actuals'} · against the plan of record
      </Metric>
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-[0.85fr_1.1fr_1.1fr] gap-5 border-y border-line py-5">
      <section className="min-w-0"><h2 className={heading}>Billable share vs target</h2><p className="text-[11px] text-muted mt-1">Share of logged time · 28 Sep – 1 Nov</p>
        <ReportGauge share={totals.shareOfLoggedPct} target={company.targetPct} />
      </section>
      <section className="min-w-0"><h2 className={heading}>Where logged hours went</h2><p className="text-[11px] text-muted mt-1">All logged hours by type of work</p>
        <ReportDonut segments={loggedSegments} total={totals.loggedHours} />
      </section>
      <section className="min-w-0"><h2 className={heading}>Billable hours by project</h2><p className="text-[11px] text-muted mt-1">Signed client projects only</p>
        <ReportDonut segments={billableSegments} total={totals.billableHours} />
      </section>
    </div>

    <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_1fr] gap-6 items-start">
      <section className="min-w-0">
        <h2 className={`${heading} mb-2`}>By person · plan vs actual and billable</h2>
        <div className="overflow-x-auto" tabIndex={0} aria-label="Person report table">
          <table className="w-full text-[11px]">
            <thead className="border-b border-line text-ink2"><tr><th className="text-left py-2 pr-2 font-semibold">Person</th><th className="text-left py-2 px-2 font-semibold">Stack</th>
              {['Available', 'Plan', 'Logged', 'Drift', 'Billable', 'Share of logged'].map(label => <th key={label} className={th}>{label}</th>)}
            </tr></thead>
            <tbody>{byPerson.rows.map(row => {
              const bill = personBill.get(row.email);
              return <tr key={row.email} className="border-b border-line hover:bg-hover">
                <td className="py-2.5 pr-2 min-w-[105px]">{row.name}</td>
                <td className="py-2.5 px-2 text-muted min-w-[85px]">{model.personByEmail.get(row.email)?.stacks.join(', ') ?? '—'}</td>
                <td className={cell}>{fmt(row.availableHours)}</td><td className={cell}>{fmt(row.plannedHours)}</td><td className={cell}>{fmt(row.actualHours)}</td>
                <td className={`${cell} ${row.driftHours > 0 ? 'text-amber-text' : ''}`}>{signed(row.driftHours)}</td>
                <td className={cell}>{bill ? fmt(bill.billableHours) : '—'}</td><td className="py-2.5 pl-2"><ReportShareBar share={bill?.shareOfLoggedPct ?? null} /></td>
              </tr>;
            })}</tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted mt-2">Hours · Horváth Lili starts 16 Nov; no logged-time share for this period.</p>
      </section>

      <section className="min-w-0">
        <h2 className={`${heading} mb-2`}>By project · plan vs actual</h2>
        <div className="overflow-x-auto" tabIndex={0} aria-label="Project report table">
          <table className="w-full text-[11px]">
            <thead className="border-b border-line text-ink2"><tr><th className="text-left py-2 pr-2 font-semibold">Project</th><th className="text-left py-2 px-2 font-semibold">Type</th>
              {['Plan', 'Logged', 'Drift', 'Drift %'].map(label => <th key={label} className={th}>{label}</th>)}
            </tr></thead>
            <tbody>{byProject.rows.map(row => <tr key={row.projectId} className="border-b border-line hover:bg-hover">
              <td className="py-2.5 pr-2 min-w-[125px]">{row.name}</td><td className="px-2"><TypeTag type={row.type} /></td>
              <td className={cell}>{fmt(row.plannedHours)}</td><td className={cell}>{fmt(row.actualHours)}</td>
              <td className={`${cell} ${row.driftHours > 0 ? 'text-amber-text' : ''}`}>{signed(row.driftHours)}</td>
              <td className={cell}>{row.driftPct == null ? '—' : `${signed(row.driftPct)}%`}</td>
            </tr>)}</tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted mt-2">Hours · Unmapped-person worklogs remain on their project. Unmapped keys count as non-billable.</p>
      </section>
    </div>

    <section className="border-t border-line pt-5">
      <div className="flex flex-wrap justify-between items-baseline gap-2 mb-4"><h2 className={heading}>{burn.name} · budget burn</h2>
        <span className="text-[12px] text-muted">Hour budget: <span className="font-mono">{burn.hourBudget == null ? 'not set' : `${fmt(burn.hourBudget)} h`}</span></span>
      </div>
      <dl className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-4 text-[12px]">
        {[
          ['Logged to date', `${fmt(burn.actualHoursToDate)} h`], ['Cost to date', `€${fmt(burn.actualCostEur)}`],
          ['Budget used', burn.budgetUsedPct == null ? 'not set' : pct(burn.budgetUsedPct)],
          ['Remaining planned', `${fmt(burn.remainingPlannedHours)} h`], ['Remaining unstaffed', `${fmt(burn.remainingUnstaffedHours)} h`],
          ['Forecast', `${fmt(burn.forecastHours)} h`], ['Forecast vs budget', burn.forecastVsBudgetPct == null ? 'not set' : pct(burn.forecastVsBudgetPct)],
        ].map(([label, value]) => <div key={label}><dt className="text-muted mb-1">{label}</dt><dd className="font-mono text-[17px] font-semibold">{value}</dd></div>)}
      </dl>
    </section>
  </div>;
}