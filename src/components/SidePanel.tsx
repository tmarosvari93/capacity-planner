import type { ReactNode } from 'react';

export function SidePanel({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/10" onClick={onClose}>
      <aside className="w-[420px] h-full bg-white border-l border-line shadow-xl overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}
        role="dialog" aria-label={title}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="text-[15px] font-semibold">{title}</h2>
          <button aria-label="Close" onClick={onClose} className="text-hint-2 hover:text-ink text-lg leading-none">×</button>
        </div>
        {children}
      </aside>
    </div>
  );
}
