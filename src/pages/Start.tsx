import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

type ManifestFile = { path: string; source: string; kind: string; exportedAt: string };

const LOOKUP: Record<string, { prod: string; key: string }> = {
  people: { prod: 'Manual upload (HR system export)', key: 'email' },
  absences: { prod: 'Manual upload (HR system export)', key: 'email + start_date + type' },
  worklogs: { prod: 'API pull from Jira', key: 'worklog id' },
  sprint: { prod: 'API pull from Jira', key: 'sprint id' },
  seed: { prod: 'Lives in the app (entered in Admin)', key: 'Not uploaded; edited in Admin' },
};

const SECTIONS = [
  { id: 'what', label: 'What this is' },
  { id: 'data', label: 'Where the data comes from' },
  { id: 'pages', label: 'How to read each page' },
  { id: 'checks', label: 'What the import checks do' },
  { id: 'tour', label: 'Suggested tour' },
  { id: 'limits', label: 'What this demo does not do' },
];

const PAGES = [
  { to: '/', name: 'Home', what: 'What needs attention this week: shortages, over and idle people, free capacity, billable time.', click: 'Click "Ask about this" on any tile.' },
  { to: '/plan', name: 'Plan', what: 'Who works on what, week by week, from signed and internal work.', click: 'Click a person\u2019s week to see the hours behind it.' },
  { to: '/reports', name: 'Reports', what: 'What happened in the last five weeks: plan vs logged time, billable share, budget burn.', click: 'Look at the by-project drift table.' },
  { to: '/ask', name: 'Ask', what: 'Ask a question in plain words; a tested function finds the numbers and Claude writes the conclusion.', click: 'Click one of the suggested question chips.' },
  { to: '/admin', name: 'Admin', what: 'Add or edit projects, people skills and Jira mappings.', click: 'Map an unmapped Jira key to a project.' },
];

const CHECKS = [
  ['F1', 'Jira author not in HR or the account map', 'Hours stay on the project but are left out of people views.', 'warning', true],
  ['F2', 'Jira project key not mapped', 'Hours are kept under the unmapped key and count as non-billable until mapped.', 'warning', true],
  ['F3', 'Worklog has no FE/BE label', 'No effect; actuals use the person\u2019s main stack.', 'info', false],
  ['F4', 'Pipeline project has no win chance', 'Shown as "not set" in Admin.', 'info', false],
  ['F5', 'Sprint issue has no estimate', 'Counted as zero hours, so planned load should not be trusted blindly.', 'warning', false],
  ['F6', 'Absence overlaps a non-working day', 'The day is not deducted twice.', 'info', false],
  ['F7', 'Weekly hours blank in HR', 'A full-time default is used; HR should fix the source.', 'warning', false],
  ['F8', 'Date cannot be read or is not ISO', 'Other common formats are accepted and flagged; unreadable rows are skipped.', 'warning / error', false],
] as const;

const fmt = (iso: string) => {
  const d = new Date(iso);
  return isNaN(+d) ? iso : d.toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Budapest' });
};

const btn = 'inline-block border border-input rounded px-2.5 py-1 text-[12px] bg-white hover:bg-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy';
const link = 'underline text-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-navy rounded-sm';

function Sev({ s }: { s: string }) {
  return <span className={`text-[11px] font-semibold rounded px-1.5 py-0.5 whitespace-nowrap ${s === 'info' ? 'bg-hover text-ink2' : 'bg-amber-t3 text-amber-text'}`}>{s}</span>;
}

export default function Start() {
  const [files, setFiles] = useState<ManifestFile[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    fetch('/data/manifest.json')
      .then((r) => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then((j) => setFiles(Array.isArray(j?.files) ? j.files : []))
      .catch((e) => setErr(`Could not load the file list (${e instanceof Error ? e.message : String(e)}).`));
  }, []);

  const go = (id: string) => (e: React.MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    history.replaceState(null, '', `#${id}`);
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 max-w-[1100px]">
      <nav aria-label="On this page" className="md:w-[190px] shrink-0">
        <div className="md:sticky md:top-4">
          <div className="eyebrow mb-1.5">On this page</div>
          <ul className="text-[12px] space-y-1">
            {SECTIONS.map((s) => <li key={s.id}><a href={`#${s.id}`} onClick={go(s.id)} className={link}>{s.label}</a></li>)}
          </ul>
        </div>
      </nav>

      <div className="flex-1 min-w-0 space-y-4">
        <section id="what" className="card p-4 scroll-mt-4">
          <div className="eyebrow">Start here</div>
          <h1 className="text-[22px] font-semibold mb-2">How this demo works</h1>
          <p className="text-[13px] text-ink2 max-w-[720px] mb-3">
            Capacity Planner answers four questions about an agency's people and projects: who is free in 4 weeks, which skill runs short, who is over 100% or idle, and how much time went to billable work.
            It runs on fictional data shaped like real HR and Jira exports.
            Today is fixed at Monday 2 November 2026.
          </p>
          <Link to="/" className={btn}>Go to Home</Link>
        </section>

        <section id="data" className="card p-4 scroll-mt-4">
          <h2 className="text-[16px] font-semibold mb-1">Where the data comes from</h2>
          <p className="text-[12px] text-ink2 mb-3">
            {files ? `${files.length} files` : 'The files'} in /data. In a real agency some would arrive by API, some by manual upload, and some live in the app itself.
          </p>
          {err && <p role="alert" className="text-[12px] text-amber-text">{err}</p>}
          {!err && !files && <p className="text-[12px] text-hint-2">Loading file list...</p>}
          {files && (
            <div className="overflow-x-auto">
              <table className="w-full text-[12px]">
                <thead><tr className="text-left text-ink2 border-b border-line">
                  <th className="py-1.5 font-semibold pr-3">File</th><th className="font-semibold pr-3">Source</th><th className="font-semibold pr-3">Kind</th>
                  <th className="font-semibold pr-3">Exported</th><th className="font-semibold pr-3">In production</th><th className="font-semibold pr-3">Merge key on upload</th><th className="font-semibold"><span className="sr-only">Download</span></th>
                </tr></thead>
                <tbody>
                  {files.map((f) => {
                    const l = LOOKUP[f.kind];
                    return (
                      <tr key={f.path} className="border-b border-line align-top">
                        <td className="py-2 pr-3 font-mono">{f.path}</td>
                        <td className="pr-3 py-2">{f.source}</td>
                        <td className="pr-3 py-2 font-mono">{f.kind}</td>
                        <td className="pr-3 py-2 font-mono whitespace-nowrap">{fmt(f.exportedAt)}</td>
                        <td className="pr-3 py-2"><span className="text-[11px] rounded px-1.5 py-0.5 bg-navy-t1 text-navy">{l?.prod ?? 'Not specified'}</span></td>
                        <td className="pr-3 py-2 font-mono">{l?.key ?? 'Not specified'}</td>
                        <td className="py-2"><a href={`/data/${f.path}`} download className={link}>Download</a></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section id="pages" className="scroll-mt-4">
          <h2 className="text-[16px] font-semibold mb-2">How to read each page</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {PAGES.map((p) => (
              <div key={p.to} className="card p-3 text-[12px]">
                <h3 className="text-[14px] font-semibold mb-1"><Link to={p.to} className={link}>{p.name}</Link></h3>
                <p className="text-ink2">{p.what}</p>
                <p className="mt-1"><span className="font-semibold">Try:</span> {p.click}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="checks" className="card p-4 scroll-mt-4">
          <h2 className="text-[16px] font-semibold mb-1">What the import checks do</h2>
          <p className="text-[12px] text-ink2 mb-3">These rules produce the import log on Home. F1 and F2 can be fixed in <Link to="/admin" className={link}>Admin</Link>.</p>
          <div className="overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead><tr className="text-left text-ink2 border-b border-line">
                <th className="py-1.5 font-semibold pr-3">Rule</th><th className="font-semibold pr-3">Check</th><th className="font-semibold pr-3">What happens</th><th className="font-semibold">Label</th>
              </tr></thead>
              <tbody>
                {CHECKS.map(([id, check, what, sev, admin]) => (
                  <tr key={id} className="border-b border-line align-top">
                    <td className="py-2 pr-3 font-mono">{id}</td>
                    <td className="py-2 pr-3">{check}</td>
                    <td className="py-2 pr-3 text-ink2">{what}{admin && ' Fixable in Admin.'}</td>
                    <td className="py-2"><Sev s={sev} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section id="tour" className="card p-4 scroll-mt-4">
          <h2 className="text-[16px] font-semibold mb-2">Suggested tour</h2>
          <ol className="list-decimal pl-5 text-[13px] space-y-1">
            <li>On <Link to="/" className={link}>Home</Link>, open "Who is over 100%, and who is idle?"</li>
            <li>In <Link to="/plan" className={link}>Plan</Link>, click a cell in the skill matrix to see the breakdown.</li>
            <li>In <Link to="/admin" className={link}>Admin</Link>, map an unmapped Jira key and watch Reports change.</li>
          </ol>
        </section>

        <section id="limits" className="card p-4 scroll-mt-4">
          <h2 className="text-[16px] font-semibold mb-2">What this demo does not do</h2>
          <ul className="list-disc pl-5 text-[13px] space-y-1 text-ink2">
            <li>Uses fictional data only.</li>
            <li>Has no login.</li>
            <li>Does not plan pipeline projects; only signed and internal work counts.</li>
            <li>Has no live Jira or HR connection; files are static exports.</li>
            <li>Changes made in Admin and Plan are stored in this browser and can be undone with Reset Admin and Plan edits.</li>
            <li>Is not production-ready.</li>
          </ul>
        </section>
      </div>
    </div>
  );
}
