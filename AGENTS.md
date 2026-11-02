# AGENTS

- App is plain Vite + React + react-router + Tailwind (not TanStack Start); it was layered onto the existing core repo without replacing its package.json scripts.
- All app state lives in `src/state/ModelContext.tsx` (dataset, edit layer, model); pages read it via `useModel()` so every number comes from `src/core`.
- Reports use core historical summaries without pipeline scenarios; reusable SVG report charts render those summaries without changing calculation logic.
- Never edit `src/core`, `tests`, `fixtures`, `scripts`, `public/data`, `supabase/functions/ask` (see CORE.md); they are verified by the answer-key tests.
