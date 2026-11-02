# Lovable prompt 00: setup (paste first)

Read these files in this repo before you change anything: `CORE.md`, `DATA_CONTRACT.md`, `docs/ui/DESIGN_TOKENS.md`, `docs/ui/canvas/Main.dc.html` (visual reference only), and the page prompt I give you next from `docs/lovable/`.

## Rules (never break)

1. **Do not edit** `src/core/`, `tests/`, `fixtures/`, `scripts/`, `public/data/`, `supabase/functions/ask/`, `.github/`, `vitest.config.ts`, `tsconfig.core.json`.
2. **Every number comes from `src/core`.** Never compute hours, loads, percentages, FTE or dates in a component. Import from `@/core` (add a path alias `@/core` -> `src/core` if it is missing).
3. Do not invent data. All data is loaded from `public/data/` by `loadAll`.
4. Light theme, desktop first (1440 px), IBM Plex Sans and Mono, colours from `docs/ui/DESIGN_TOKENS.md`. Show a number next to every colour. No "design review" state switchers.
5. No Gantt tab. Ask shows one question and one answer, never a chat thread.

## Do now

1. `package.json`: keep Lovable's, and add these from `CORE.md`: devDependencies `typescript@5.6.3`, `vitest@2.1.8`, `@types/node@22.10.2`, and scripts `"test": "vitest run --config vitest.config.ts"`, `"typecheck": "tsc --noEmit -p tsconfig.core.json"`, `"data": "python3 scripts/generate_sample_data.py"`. Do not touch `vitest.config.ts` or `tsconfig.core.json`.
2. Create `src/state/ModelContext.tsx`, one React context that holds:
   - `dataset` from `loadAll((p) => fetch(`/data/${p}`).then(r => r.text()))`
   - `layer` from `loadOverrides()`
   - `model = applyOverrides(dataset, layer)`, rebuilt after every change
   - `scenario = layer.scenario` (undefined = baseline)
   - actions: `applyOp(op)` (uses `withOp`, saves with `saveOverrides`), `setScenario(sc)` (uses `withScenario`), `reset()` (uses `resetOverrides`)
   - loading and error states (show "Loading sample data..." and a readable error).
3. App shell: left sidebar (Home, Plan, Reports, Admin, Ask) and a top bar with **Today Mon 2 Nov 2026**, the scenario name from `describeScenario(model, scenario)`, and a **Reset edits** button. Routes: `/`, `/plan`, `/reports`, `/admin`, `/ask`.
4. Empty placeholder pages for the five routes. Do not build page content yet.

## Done when

The app builds, the five routes open, the top bar shows "Baseline", and `npm test` still passes (104 tests).
