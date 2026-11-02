export interface ReportSegment { label: string; hours: number }

const tones = ['report-chart-primary', 'report-chart-secondary', 'report-chart-tertiary'];
const number = (value: number) => value.toLocaleString('en-GB', { maximumFractionDigits: 2 });

export function ReportDonut({ segments, total }: { segments: ReportSegment[]; total: number }) {
  let offset = 0;
  return (
    <div className="flex flex-wrap items-center gap-5 mt-5">
      <svg viewBox="0 0 120 120" className="w-32 h-32 shrink-0" role="img" aria-label={`${number(total)} logged hours`}>
        <circle cx="60" cy="60" r="45" pathLength="100" className="report-chart-track" strokeWidth="16" fill="none" />
        {segments.map((segment, i) => {
          const length = total > 0 ? segment.hours / total * 100 : 0;
          const start = offset;
          offset += length;
          return <circle key={segment.label} cx="60" cy="60" r="45" pathLength="100" fill="none" strokeWidth="16"
            className={tones[i % tones.length]} strokeDasharray={`${length} ${100 - length}`} strokeDashoffset={-start} transform="rotate(-90 60 60)">
            <title>{segment.label}: {number(segment.hours)} h</title>
          </circle>;
        })}
      </svg>
      <ul className="flex-1 min-w-[150px] text-[12px] space-y-3">
        {segments.map((segment, i) => <li key={segment.label} className="flex items-start gap-2">
          <svg viewBox="0 0 10 10" className="w-2.5 h-2.5 mt-1 shrink-0" aria-hidden="true"><rect width="10" height="10" className={`${tones[i % tones.length]} report-chart-swatch`} /></svg>
          <span className="flex-1">{segment.label}</span><span className="font-mono whitespace-nowrap">{number(segment.hours)} h</span>
        </li>)}
      </ul>
    </div>
  );
}

export function ReportGauge({ share, target }: { share: number | null; target: number }) {
  const value = share ?? 0;
  const angle = Math.PI * (1 - Math.max(0, Math.min(target, 100)) / 100);
  const needleAngle = Math.PI * (1 - Math.max(0, Math.min(value, 100)) / 100);
  const below = Math.round((target - value) * 10) / 10;
  return <div className="mt-4 text-center">
    <svg viewBox="0 0 240 140" className="w-full max-w-[260px] mx-auto" role="img" aria-label={`Billable share ${share ?? 'not available'} percent; target ${target} percent`}>
      <path d="M 25 110 A 95 95 0 0 1 215 110" fill="none" strokeWidth="18" pathLength="100" className="report-chart-track" />
      <path d="M 25 110 A 95 95 0 0 1 215 110" fill="none" strokeWidth="18" pathLength="100" strokeDasharray={`${Math.max(0, Math.min(value, 100))} 100`} className="report-chart-primary" />
      <line x1={120 + Math.cos(angle) * 82} y1={110 - Math.sin(angle) * 82} x2={120 + Math.cos(angle) * 110} y2={110 - Math.sin(angle) * 110} strokeWidth="3" className="report-chart-target" />
      <line x1="120" y1="110" x2={120 + Math.cos(needleAngle) * 74} y2={110 - Math.sin(needleAngle) * 74} strokeWidth="3" className="report-chart-needle" />
      <circle cx="120" cy="110" r="5" className="report-chart-needle report-chart-swatch" />
      <text x="25" y="135" textAnchor="middle" className="report-chart-label">0%</text>
      <text x="215" y="135" textAnchor="middle" className="report-chart-label">100%</text>
    </svg>
    <div className="font-mono text-[24px] font-semibold">{share == null ? '—' : `${share}%`}</div>
    <div className={`text-[12px] font-semibold ${below > 0 ? 'text-amber-text' : 'text-navy'}`}>
      {share == null ? 'No logged hours' : below > 0 ? `${below} pts below target · target missed` : 'target met'}
    </div>
    <div className="text-[11px] text-muted mt-1">Target {target}% of logged time</div>
  </div>;
}

export function ReportShareBar({ share }: { share: number | null }) {
  return <div className="flex items-center justify-end gap-2">
    <span className="font-mono w-12 text-right">{share == null ? '—' : `${share}%`}</span>
    <svg viewBox="0 0 100 6" className="w-20 h-1.5 shrink-0" aria-hidden="true">
      <rect width="100" height="6" rx="2" className="report-chart-track report-chart-swatch" />
      <rect width={Math.max(0, Math.min(share ?? 0, 100))} height="6" rx="2" className="report-chart-primary report-chart-swatch" />
    </svg>
  </div>;
}