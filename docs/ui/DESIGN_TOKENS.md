# Design tokens (read from the design canvas, `docs/ui/canvas/Main.dc.html`)

Light theme, desktop first (1440 px), plain and dense. Numbers always sit next to colour, never colour alone.

| Token | Value | Used for |
|---|---|---|
| Page background | `#F5F6F7` | app background, function boxes |
| Card | `#FFFFFF`, 1 px `#E4E6E9`, radius 10 px | all cards |
| Text | `#1B1D21` | body |
| Text, secondary | `#3C424B` / `#4F5661` | nav, labels, "muted" |
| Hover / selected surface | `#EEF0F2` | current nav item |
| Border, input | `#CBD0D6` | chips, inputs |
| Primary (navy) | `#1C3A62`, hover `#0F2440` | links, primary buttons, dots |
| Primary tint | `#DCE7F5`, `#A9C1DE`, `#4F7CAC` | selected/info |
| Accent (amber) | `#B85C1E`, text `#6E2E00` | over capacity, warnings, manual edit |
| Accent tint | `#FFF4EC`, `#FFEBDB`, `#FDE7D6`, `#F9D3B4` | over-capacity cells, warning rows |
| Disabled / hint | `#8E97A3`, `#6B7380`, `#B7BEC7` | greyed joiners, empty |

Fonts: IBM Plex Sans (UI) and IBM Plex Mono (all numbers, ids, function names), from Google Fonts. Sizes: 11 px eyebrow labels (uppercase, letter-spacing 0.04em, weight 600), 12 px table text, 13 px nav and buttons, 14-16 px headings.

Load bands (always show the % as text): **over** > 100% amber `#B85C1E` on `#FFF4EC`; **healthy** 51-100% navy text on white; **idle** ≤ 50% muted grey on `#EEF0F2`; **away** hatched grey with an "away" label.

Components seen on the canvas: `.card`, nav button (`.navb`, current = `.cur`), Ask chip (`.askchip`), status dot (`.dot`, pulsing amber while an answer is being made), function box (`.fnbox`, mono text).

The full markup and exact spacing are in `docs/ui/canvas/Main.dc.html` (a single component; the `startPage` prop picks Home, Plan, Reports, Admin or Ask). It uses a custom `x-dc` format, so treat it as a visual and copy reference, not code to run. Rebuild in React with the tokens above.
