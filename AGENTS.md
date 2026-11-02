# AGENTS

- App is plain Vite + React + react-router + Tailwind (not TanStack Start); it was layered onto the existing core repo without replacing its package.json scripts.
- All app state lives in `src/state/ModelContext.tsx` (dataset, edit layer, model); pages read it via `useModel()` so every number comes from `src/core`.
- Reports use core historical summaries without pipeline scenarios; reusable SVG report charts render those summaries without changing calculation logic.
- Admin forms and panels dispatch context operations only; creation is validated by projectFromForm and HR/settings/account-map fields remain read-only to preserve imported facts.
- Never edit `src/core`, `tests`, `fixtures`, `scripts`, `public/data`, `supabase/functions/ask` (see CORE.md); they are verified by the answer-key tests.
- Scenario (pipeline what-if) UI and state are removed; the app always calls core functions without a scenario, and ModelContext clears any saved scenario on load. Core scenario code stays because it is protected.
