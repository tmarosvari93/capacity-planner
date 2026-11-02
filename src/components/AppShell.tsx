import { NavLink, Outlet } from 'react-router-dom';
import { describeScenario, lastSync } from '@/core';
import { useModel } from '@/state/ModelContext';

const NAV = [
  { to: '/', label: 'Home' },
  { to: '/plan', label: 'Plan' },
  { to: '/reports', label: 'Reports' },
  { to: '/admin', label: 'Admin' },
  { to: '/ask', label: 'Ask' },
];

const fmt = (iso: string) => {
  const d = new Date(iso);
  return isNaN(+d) ? iso : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Budapest' });
};

export default function AppShell() {
  const { model, scenario, reset, layer } = useModel();
  const syncs = lastSync(model);
  return (
    <div className="flex min-h-screen">
      <aside className="w-[200px] shrink-0 bg-white border-r border-line flex flex-col px-2.5 py-4">
        <div className="px-1 mb-5">
          <span className="font-semibold text-sm">Capacity</span>
          <span className="text-[11px] text-muted ml-1.5">fictional agency data</span>
        </div>
        <nav className="flex flex-col gap-1">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end
              className={({ isActive }) => `rounded-md px-2.5 py-2 text-ink2 ${isActive ? 'bg-hover font-semibold text-ink' : 'hover:bg-hover'}`}>
              {n.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-1 text-[11px] text-ink2 space-y-3">
          <div className="bg-hover rounded px-1.5 py-1 font-semibold text-ink">Scenario: {describeScenario(model, scenario)}</div>
          <div>
            <div className="mb-0.5">Last sync</div>
            {syncs.map((s) => (
              <div key={s.source}>{s.source} <span className="font-mono">{fmt(s.exportedAt)}</span></div>
            ))}
          </div>
          <button onClick={reset} disabled={!layer.ops.length && !layer.scenario}
            className="w-full border border-input rounded px-2 py-1.5 text-[12px] text-ink hover:bg-hover disabled:text-hint disabled:hover:bg-transparent">
            Reset edits
          </button>
        </div>
      </aside>
      <main className="flex-1 p-4 min-w-0"><Outlet /></main>
    </div>
  );
}
