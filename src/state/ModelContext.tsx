import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  loadAll, mergeUpload, applyOverrides, loadOverrides, saveOverrides, resetOverrides, withOp, withScenario,
  type Dataset, type Model, type Op, type OverrideLayer, type Scenario,
} from '@/core';

interface Ctx {
  dataset: Dataset;
  layer: OverrideLayer;
  model: Model;
  /** Pipeline toggles; only the Plan page reads this. */
  scenario: Scenario | undefined;
  setScenario: (sc: Scenario | undefined) => void;
  /** Admin/Plan ops plus pipeline projects whose start was shifted. */
  editCount: number;
  applyOp: (op: Op) => void;
  reset: () => void;
  upload: (path: string, text: string) => void;
}

const ModelContext = createContext<Ctx | null>(null);

export function ModelProvider({ children }: { children: ReactNode }) {
  const [dataset, setDataset] = useState<Dataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [layer, setLayer] = useState<OverrideLayer>(() => loadOverrides());
  const setScenario = useCallback((sc: Scenario | undefined) =>
    setLayer((l) => { const n = withScenario(l, sc); saveOverrides(n); return n; }), []);

  useEffect(() => {
    loadAll((p) => fetch(`/data/${p}`).then((r) => {
      if (!r.ok) throw new Error(`Could not load /data/${p} (${r.status})`);
      return r.text();
    })).then(setDataset).catch((e) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const applyOp = useCallback((op: Op) => setLayer((l) => { const n = withOp(l, op); saveOverrides(n); return n; }), []);
  const reset = useCallback(() => setLayer(resetOverrides()), []);
  const upload = useCallback((path: string, text: string) => {
    if (dataset) setDataset(mergeUpload(dataset, path, text, new Date().toISOString()));
  }, [dataset]);

  const model = useMemo(() => {
    if (!dataset) return null;
    try { return applyOverrides(dataset, layer); } catch (e) { setError(e instanceof Error ? e.message : String(e)); return null; }
  }, [dataset, layer]);

  const editCount = layer.ops.length +
    Object.values(layer.scenario?.projects ?? {}).filter((p) => (p.startShiftWeeks ?? 0) !== 0).length;

  if (error) {
    return (
      <div className="p-10">
        <div className="card p-6 max-w-xl">
          <h1 className="text-base font-semibold mb-2">The sample data could not be loaded</h1>
          <p className="text-muted mb-4">{error}</p>
          <button className="border border-input rounded px-3 py-1.5" onClick={() => location.reload()}>Try again</button>
        </div>
      </div>
    );
  }
  if (!dataset || !model) return <div className="p-10 text-muted">Loading sample data...</div>;

  return (
    <ModelContext.Provider value={{ dataset, layer, model, scenario: layer.scenario, setScenario, editCount, applyOp, reset, upload }}>
      {children}
    </ModelContext.Provider>
  );
}

export function useModel(): Ctx {
  const c = useContext(ModelContext);
  if (!c) throw new Error('useModel must be used inside ModelProvider');
  return c;
}
