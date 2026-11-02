# Lovable prompt 00: setup (paste first)

Read these files in this repo before you change anything: `CORE.md`, `DATA_CONTRACT.md`, `docs/ui/DESIGN_TOKENS.md`, and the screen images in `docs/ui/screens/` (`01-home.png`, `02-plan.png`, `03-ask.png`, `04-reports.png`, `05-admin.png`; all five are also in `capacity-planner-screens.pdf`). `docs/ui/canvas/Main.dc.html` is the design source (exact colours, spacing, copy); read it, do not run it.

## Rules (never break)

1. **Do not edit** `src/core/`, `tests/`, `fixtures/`, `scripts/`, `public/data/`, `supabase/functions/ask/`, `.github/`, `vitest.config.ts`, `tsconfig.core.json`.
2. **Every number comes from `src/core`.** Never compute hours, loads, percentages, FTE, drift or week dates in a component. Import from `@/core` (Vite's `@` alias -> `src`). Grouping rows a core function returned, or adding them up for a chart segment, is fine; deriving a new measure is not.
3. **The screen images are a layout reference only. Every number, name, date and Jira key in them is a placeholder.** Real values come from `src/core` and the files in `public/data/`. Never copy a number from an image.
4. Light theme, desktop first (1440 px), IBM Plex Sans and Mono, colours from `docs/ui/DESIGN_TOKENS.md`. Show a number next to every colour.

## Where the build differs from the images (the images are older; this list wins)

| In the images | Build instead |
|---|---|
| Plan: "Projects / People" tabs (Projects = Gantt) | **No Projects tab, no Gantt.** Plan shows only the People grid |
| Plan: "What-if changes stay until you press Apply to plan", Apply / Discard | **No Apply or Discard.** A switch or edit applies at once; **Reset edits** undoes everything |
| Plan pipeline card: switches only | Add **shift −/+ weeks** per project and an **Align starts** checkbox (see 01_PLAN) |
| Plan: "Show last 5 weeks" checkbox | Keep it, **checked by default** |
| Ask: "database query", "The backend runs database queries" | There is no database. Use the copy in 03_ASK |
| Ask: "New conversation"; "Design review only: preview each state" box | Remove both. One question, one answer, no thread. Real states only |
| Any "design review" switchers | Remove |
| Admin: "Add a project not yet in the CRM", CRM wording | "Add a project". There is no CRM |
| Admin: Jira key "HLX" | Real keys come from the data (`HELIX`, `NOVA`, `ORB`, `LDG`, `PLS`, `OPS`, unmapped `MRD`) |
| Reports: "Unmapped person" project row | No such row. Those 6 h stay on Helix claims portal (burn stays right); only "Unmapped key MRD" gets a row |
| Home data issues: "Pipeline projects are entered by hand... no CRM" | Show only the issues from `dataIssues(model)` (10 of them) |

## Do now

1. **`package.json` already exists** (core scripts and dev dependencies). **Extend it, do not replace it.** Keep the scripts `test`, `typecheck`, `data` and the devDependencies `typescript`, `vitest`, `@types/node` exactly as they are, and add what the React app needs (`dev`, `build`, `preview` scripts, React, Vite, Tailwind, etc.). Rename `"name"` to `"capacity-planner"`.
2. Create `src/state/ModelContext.tsx`, one React context that holds:
   - `dataset` from `loadAll((p) => fetch(`/data/${p}`).then((r) => r.text()))`
   - `layer` from `loadOverrides()`
   - `model = applyOverrides(dataset, layer)`, rebuilt after every change
   - `scenario = layer.scenario` (undefined = baseline)
   - actions: `applyOp(op)` (uses `withOp`), `setScenario(sc)` (uses `withScenario`), `reset()` (uses `resetOverrides`); each saves with `saveOverrides` and rebuilds the model
   - loading state ("Loading sample data...") and a readable error state.
3. App shell as in the images: left sidebar "Capacity · fictional agency data", nav Home, Plan, Reports, Admin, Ask. Sidebar footer: **"Scenario: "** + `describeScenario(model, scenario)` (shows "Baseline" when nothing is on), **Last sync** per source from `lastSync(model)`, and a **Reset edits** button. Routes: `/`, `/plan`, `/reports`, `/admin`, `/ask`.
4. Empty placeholder pages for the five routes. Do not build page content yet.
5. `supabase/config.toml`: add `[functions.ask]` with `verify_jwt = false` (the demo has no login). Do not touch the function code.

## Done when

The app builds, the five routes open, the sidebar shows "Scenario: Baseline" and last sync for HR, Jira and App, and `npm test` still passes (104 tests). Tell me if anything in `src/core` would not compile in your setup instead of changing it.
