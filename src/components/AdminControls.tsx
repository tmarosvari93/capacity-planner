import { cloneElement, isValidElement, type ButtonHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from 'react';
import { FUTURE, shortDate } from '@/core';

export const adminInput = 'w-full min-w-0 border border-input rounded bg-page px-2 py-1.5 text-[12px] focus:outline-none focus:ring-2 focus:ring-navy-t2';

export function AdminButton({ children, primary = false, className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { primary?: boolean }) {
  return <button {...props} className={`rounded border px-2.5 py-1.5 text-[12px] font-semibold disabled:opacity-50 ${primary ? 'bg-navy text-page border-navy hover:bg-navy-dark' : 'border-input text-ink hover:bg-hover'} ${className}`}>{children}</button>;
}
export function AdminField({ label, children }: { label: string; children: ReactNode }) {
  return <label className="block min-w-0 text-[11px] font-semibold text-ink2"><span className="block mb-1">{label}</span>{isValidElement<{ 'aria-label'?: string }>(children) ? cloneElement(children, { 'aria-label': label }) : children}</label>;
}
export function AdminWeekSelect(props: SelectHTMLAttributes<HTMLSelectElement> & { extraWeek?: string; emptyLabel?: string }) {
  const { extraWeek, emptyLabel, ...rest } = props;
  const weeks = extraWeek && !FUTURE.includes(extraWeek) ? [extraWeek, ...FUTURE] : FUTURE;
  return <select {...rest} className={adminInput}>{emptyLabel && <option value="">{emptyLabel}</option>}{weeks.map(week => <option key={week} value={week}>{shortDate(week)} · {week.slice(0, 4)}</option>)}</select>;
}