# Captain Passage Tool: design v2 brief

## Who this is for and what went wrong

The user is a superyacht captain. He said the app is "still confusing", "a tech tool for nerds", and asked for it to be "proper beautiful like a SaaS", "more groups", "much more user friendly", and he wants a "simple mode". His writing style preferences apply to every string in the UI: direct, no fluff, no em dashes, no filler, plain words.

Diagnosis of the current build (branch `claude/design-v2`, cut from `claude/deploy`, renders of the current state are in `/tmp/design-renders/after-*.png` and `phase5-after-*.png`, read a few before you start):

1. One passage is split across four "modes" (Professional / Simplified / Comparison / Monitor) as tabs. That is organised by data shape, not by what a captain does. He has to know which tab holds what.
2. The Professional table shows 15 columns with pipeline jargon: `p10 / p50 / p90`, `WN2`, `ECMWF ENS`, `EST x1.3`, `atmos init 09/05 00:00Z`, `run recheck 39 min ago`, `Sources atmospheric 5/5 · comparison 5/5 · marine 4/4`, `Comparison columns` toggle. Internals leaking into the product.
3. Eight buttons in the page header: Plan targets, Fetch now, Re-check, GPX, Export PDF, Edit, Monitor, Mark active. There should be one primary action and a menu.
4. A `Raw ↔ Narrative` slider in the global header that nobody understands.
5. Everything is uppercase 11 px mono labels, every element has a 1 px border, panel inside panel inside tile. It reads like a trading terminal (that was the original reference; the user has now moved past it).
6. The passages list is a table with columns "Worst flag", "Last run", "Briefing confidence": internal concepts, no grouping, no sentence a human would say.
7. Empty states say "Plan targets, fetch, then compute". Nobody outside this codebase knows what that means.
8. The chart area shows a legend of seven swatches and 15 field cards in a grid at once.

What is good and must stay: the dark palette, the weather-first landing map, the map itself, the data honesty rules (hatched "no data" cells with the reason, disclaimer bar on chart views, attribution footer, SOLAS line on briefings, no advisory language, confidence stated, gust and depth provenance visible), the fact that every number remains reachable.

## The target: a calm, grouped, plain-English product

Think of the feel of Linear, Vercel, Stripe dashboards, Arc: generous spacing, a clear type scale, few borders, one accent colour, sentence-case labels, one primary action per screen, cards that each do one thing, progressive disclosure. Dark theme stays. Numbers stay (captains want numbers) but presented as "12 to 18 kn from the west", not "p10/p50/p90 8/12/16 · 245°".

### Design system changes (Tailwind tokens + `src/index.css` + `src/components/ui/*`)

- Keep the PRD §9.2 colours. Add: `--bg-elev` for raised cards (use `#131D33`), `--border-soft` = border at 55% opacity, and a soft shadow token `shadow-card: 0 1px 0 rgba(255,255,255,0.03) inset, 0 8px 24px rgba(0,0,0,0.28)`.
- Surfaces: page `bg-0`, cards `bg-1` with `border-soft` and 12 px radius and `shadow-card`. Do not nest bordered boxes more than two levels. Separate groups with space (16 to 24 px) and section headings, not with lines.
- Type: Inter, base 14 px on desktop, 15 px on phones. Scale: page title 24/600 tight tracking, section title 16/600, card title 14/600, body 14/400 line-height 1.55, caption 12/400 `text-2`, label 12/500 sentence case `text-3` (drop the uppercase 0.06em style everywhere except the small caps in the print page and inside charts axes). Mono (`.num`) only for actual numbers, times and coordinates, never for whole phrases.
- Buttons (`ui/button.tsx`): sizes md 36 px / sm 30 px, radius 8 px, primary = teal fill with dark text, secondary = `bg-2` fill no border, ghost = text only, danger. Icons 16 px. Loading state with spinner.
- Add `ui/dropdown-menu.tsx`. `@radix-ui/react-dropdown-menu` is NOT installed and cannot be installed (no registry access), so build a small accessible menu by hand: button with `aria-haspopup`, Escape and outside click to close, arrow-key focus, portal not required. Overflow menus replace button clusters.
- Add `ui/segmented.tsx` (two to four options, used for Simple / Detailed and chart modes), `ui/section.tsx` (heading + optional description + right-side actions + children), `ui/stat.tsx` (label, value, sub, optional tone), `ui/empty-state.tsx` (icon, title, one sentence, one button).
- Risk language: keep the three words Green / Amber / Red for the flag (captains use them) but render as a coloured dot plus the word in sentence case in a soft pill (`bg-risk-x/12`, text `risk-x`), no uppercase, no icon glyphs. "Unknown" renders as a grey dot and the words "No data".
- Chips for provenance (`GustSourceChip`, `DepthSourceChip`, `SquallBadge`, `DisagreementBadge`): keep them but tone them down: 11 px, sentence case, `bg-2`, muted text, colour only for the disagreement (violet) and squall likely (amber). They appear in Detailed mode and in tooltips; in Simple mode only the depth "verify on chart" chip and the disagreement badge stay visible because they change what the captain does.
- Motion: 150 ms ease on hover and expand, respect reduced motion.

### Plain-English layer (`src/lib/plain.ts`, unit-tested)

Functions that turn rows into sentences, used everywhere in Simple mode and in card headers in Detailed mode:
- `windPhrase(p50, p90, dirDeg, gustP90)` → "12 to 18 kn from the west, gusts to 24" (use 8-point compass words; if p50 is null return null). "to" for ranges, never a dash.
- `seaPhrase(hs, periodS, swellM, swellDir)` → "1.1 m sea at 7 s, 0.8 m swell from the south-west".
- `tidePhrase(heightM, datum, state)` → "2.0 m above LAT, rising".
- `currentPhrase(kn, towardDeg)` → "0.3 kn setting north-east".
- `riskHeadline(conditions, legs, waypoints)` → one sentence for the hero: "Conditions look manageable for the whole passage." / "One stretch to watch: Ko Ha, amber on Friday afternoon (gusts to 38 kn)." / "Two legs exceed your limits: Ko Ha and Ko Phi Phi Don." / "Not checked yet." Uses risk reasons already stored; never advisory (no "safe", no "should"; the banned phrase list is in `supabase/functions/_shared/language-rules.ts`, reuse it in a test).
- `confidencePhrase(level, triggers)` → "High confidence" / "Moderate confidence: models disagree at Ko Ha" (map triggers to short reasons; the mapping exists in `confidence.ts`).
- `etaPhrase(eta, etaPlanned, utcOffset)` → "Arrive Fri 5 Sep 09:40 local (16 min later than planned, sea state)".
- `whenPhrase(iso, utcOffset, nowMs)` → "Thu 10 Sep, 18:30 local" / "in 3 days" / "2 hours ago". Use the existing `fmtLocal`/`fmtUtc` for the UTC forms in Detailed mode.
- Tooltips explain the statistics once: hovering a wind range shows "Likely (median) to high-end (90th percentile) of the forecast ensemble" plus the raw p10 / p50 / p90.

### Information architecture

Navigation (Shell): top bar stays but simplified: brand, three items (Weather, Passages, Vessel), right side: notification bell and an avatar menu (email, Settings, Sign out). Remove the Raw/Narrative slider from the header; the display prefs (UTC offset, chart overlays) move to a Settings page at `/settings` (new, simple form) and the OpenSeaMap/NOAA toggles stay on the maps. Mobile: bottom tab bar with the same three items plus Alerts; the top bar shrinks to brand + bell.

Routes:
- `/` Weather map (polish only, see below).
- `/passages` list, grouped.
- `/passages/new`, `/passages/:id/edit` builder (polish + copy).
- `/passages/:id` ONE passage page (replaces `DashboardPro`, `DashboardSimple`, `ActivePassage` as separate destinations). Keep `/passages/:id/simple` and `/passages/:id/active` as redirects to `/passages/:id` so old links work.
- `/passages/:id/table` the full professional table page (what `DashboardPro`'s table was), reachable from the Detailed toggle and the overflow menu as "Full table". This satisfies the raw-data rule without making it the landing view.
- `/passages/:id/comparison` stays, restyled, reached from the overflow menu "Compare models".
- `/passages/:id/anchorage/:wpId` stays, restyled to the new system.
- `/passages/:id/print` unchanged except tokens.
- `/vessels`, `/vessels/:id` polish + plain labels.
- `/notifications` restyle as "Alerts".
- `/settings` new.

### The passage page (`src/pages/Passage.tsx`)

Header (sticky, `bg-1`): back link "Passages", title, one line under it: "Aurora Borealis · Phuket to Ko Lanta · 70 nm · departs Thu 4 Sep 12:58 local" and a status pill (Planned / Underway / Completed; use these words, map from planned/active/completed). Right side: a `Simple | Detailed` segmented control (persisted in display prefs as `detail_level`), ONE primary button that depends on state, and an overflow menu.
- Primary button: no run yet → "Check conditions"; planned with a run → "Refresh conditions"; underway → "Re-check now". While busy show the spinner and "Checking…". `compute()` already calls plan-targets first; keep it that way.
- Overflow menu: Edit route, Start passage (planned) / Mark completed (underway), Full table, Compare models, Export GPX, Print briefing, and under a divider "Advanced": Refresh forecast data (was Fetch now), Recompute route points (was Plan targets). Plain labels, tooltips with one sentence.

Then the page is a sequence of groups, each a `Section` with a heading, in this order:

1. **Alerts** (only when present): the material-changes banner, restyled softer (amber left rail, not a full yellow box), dismiss on the right. One instance only.
2. **At a glance**: a hero card. Left: the `riskHeadline` as a 20 px sentence, then `confidencePhrase` as a caption with the confidence dot. Right (or below on mobile): four stats: Departure, Arrival (with the sea-state delay as a sub line), Worst stretch (leg name, when, the one number that matters), Checked (age of the run, "checks again automatically each hour" when a scheduled recheck exists). No run yet → the hero becomes an empty state with three numbered steps (Route set ✓ → Check conditions → Read the briefing) and the primary button.
3. **Briefing**: the briefing card restyled: sparkles icon, "Briefing" title, confidence pill, age, Regenerate as a ghost button. Body text 15 px, line-height 1.6, max width 68ch. "Worth considering" callout with the teal rail stays. Disagreement note stays violet. Model name and prompt version move into a tooltip on the age. Unavailable / none states use `EmptyState`.
4. **Route** (two columns on desktop: map 55%, legs 45%): the map with risk-coloured segments and the disclaimer bar. Next to it a vertical **leg list**: one card per waypoint from the second onwards, showing: leg number and "Ko Racha Yai → Ko Phi Phi Don", ETA ("Fri 06:40 local"), distance, a coloured risk rail on the left, and two lines of plain English: wind phrase and sea phrase, plus a tide phrase when the waypoint is an anchorage. Chips: only disagreement and the "along the leg worse than the waypoint" marker ("Worse mid-leg: 32 kn at 13:00"). Clicking a card selects it (drives the map highlight and section 5). When the passage is underway the list gains the progress bar and arrived toggles that `ActivePassage` had (same behaviour, same hooks) and the current leg is highlighted.
5. **Conditions along the selected leg**: heading shows the selected leg name and a leg picker (segmented or a select on mobile). Contents: the `LegProfile` chart (keep it, simplify its legend to a single line of four items with the rest in a tooltip), then a row of six `Stat`s in Simple mode (Wind, Gusts, Sea, Swell, Current, Squall risk) with phrases as values, and in Detailed mode the full field-card grid that `DashboardPro` had (all 15, including provenance chips and "no data" reasons). Below, the wind band chart under a "Wind at the waypoint over time" subheading in Detailed mode only.
6. **Tide and depth**: `TideChart` (tide only) by default with a small "Show swell and under-keel clearance" switch that swaps in `TideSwellChart`. Beside it three stats: Tide at arrival, Under-keel clearance (with the depth source chip and "verify on chart" when GEBCO), Charted depth. If the vessel has no draft or the waypoint no depth, an inline hint with a link to where to add it.
7. **Departure windows**: restyled as a short list of cards "Fri 06:00 to 08:00 local · winds under 19 kn, models agree" with a caption that says which come from the raw series and which from the briefing model, both advisory.
8. **Data and sources** (collapsed by default, `details`-style): what the old sources strip showed, in sentences: "Wind from Google WeatherNext ensemble, run 05 Sep 00:00 UTC, updated 48 min ago. Sea state from Open-Meteo Marine…", plus the along-leg point count, plus the two Advanced actions. This is the only place `init_time`, model ids and target counts appear in Simple mode.

Simple vs Detailed: Simple hides the field-card grid, the band chart, provenance chips (except depth and disagreement), model ids, UTC forms (shows local with UTC in tooltips), and the "Full table" link stays in the menu. Detailed shows everything DashboardPro showed today, inside the same groups, plus a "Full table" button in section 4's header. Default is Simple.

### Passages list (`src/pages/PassageHistory.tsx` → rename to `Passages.tsx`)

Title "Passages", primary "New passage". Group the list under headings **Underway**, **Upcoming**, **Past** (hide empty groups). Each passage is a card: name (16/600), "Phuket → Ko Lanta · Aurora Borealis · 70 nm", the departure as `whenPhrase`, then one plain line from `riskHeadline` (or "Not checked yet"), a risk dot, confidence caption, and a hover overflow (Open, Edit route, Duplicate route if cheap, Delete with confirm). Card click opens the passage. Past passages are compact rows. Keep the "create a vessel first" hint but as an `EmptyState` with the button. Load the extra data the same way the current page does.

### Weather map (`/`)

Keep everything functional. Polish: the seven vertical layer chips on the left become one floating pill bar at the bottom centre above the time scrubber (Wind, Gusts, Waves, Swell, Rain, Pressure, Radar) with icons and labels, active state teal; the model switch (ECMWF / GFS) and "Particles" toggle move into a small "Map options" popover button at the top left with the zoom controls; the model/run caption stays as a subtle caption on the scrubber. Right rail: keep the 7-day strip and "Plan a passage" but with the new card style and 16 px padding, and add a "Your passages" list of up to three upcoming passages with their risk dot so the landing page is also a home. Point card: new card style, phrases first, numbers second.

### Builder

Same layout, new components. Copy: "Save route" (not "Save and plan targets"), "Departure" label with local time, "Vessel". Move "Manual confidence triggers" and the CSV column hint under an "Advanced" disclosure. Waypoint sheet: group fields into "Position", "Anchorage" (toggle reveals stay end and exposure), "Depth" (charted depth with the GEBCO suggestion), "Notes" (complex coastal toggle with one sentence explaining the effect). Empty map hint stays.

### Vessel page

Group the form: "Vessel" (name, cruise speed, draft, beam, air draft) and "Your limits" (max wind, max gust, max wave, max current, min under-keel clearance) with a one-line explanation under the group: "Legs are flagged amber above 75% of a limit and red above it." Keep `ThresholdPreview` as "What this changes on your current passage".

### Alerts page and bell

Rename Notifications → Alerts everywhere. List grouped by day, each item a card with the title, the change lines, "Open passage". Bell dropdown uses the same items.

### Comparison and anchorage pages

Restyle to the new tokens and Section/Stat components. Anchorage: hero with "Stay at Ko Racha Yai, Fri 14:00 to Sat 08:00 local", stats (wind, worst gust, swell, tide range, minimum clearance), wind rose, tide chart with the swell switch. Comparison: keep the two-column table, new table styling (14 px, row height 40, soft borders).

### Mobile

Bottom tab bar (Weather, Passages, Vessel, Alerts). Passage page sections stack in the same order; the map collapses behind a "Show map" strip as today; leg cards full width; the leg profile scrolls horizontally in its own container; stats become a two-column grid; the segmented Simple/Detailed control sits under the title. Tap targets 44 px.

## Rules that do not change

- Never write advisory language in UI copy (no "safe", "you should", "go/no-go"). Describe, never decide. Add a unit test that runs the banned-phrase regexes from `language-rules.ts` over every string in `src/lib/plain.ts` outputs for a set of fixture rows.
- No em dashes or en dashes anywhere in UI copy. Add a test that greps `src/**/*.tsx` and `src/lib/plain.ts` for U+2013 and U+2014 in string literals and fails if any are found (chart axis ticks and the print page included).
- "No data" is always visible as a hatched cell or a "No data" stat with the reason in a tooltip, never a blank.
- Disclaimer bar on every view with a map or chart; attribution footer on every page; SOLAS line stays at the end of the briefing text.
- Do not edit anything under `supabase/`. Do not change hooks' data contracts; you may add fields to display prefs (`detail_level`).
- `npm run typecheck`, `npm run lint`, `npx vitest run`, `npm run build` must all pass. Keep the existing tests green; update fixtures and preview gallery as needed.
- Dependencies: only what is already in `node_modules` (the sandbox has no npm registry access).

## Deliverables

1. Work on branch `claude/design-v2` (already exists, cut from `claude/deploy` at `bb3d29d`). Commit in sensible steps with clear messages. Push when done. No PR.
2. Renders: extend `scripts/design-renders.mjs` with a `--set v2` shot list covering: landing desktop+mobile, passages list desktop+mobile, passage page Simple desktop+mobile (fixture passage `p1`, which has an amber and a red leg), passage page Detailed desktop, passage page with no run (an empty-state fixture; add one to `src/preview/fixtures.ts` if none exists), passage page underway (p1 is active in fixtures), leg selected with the profile visible, tide section with the swell switch on, full table page, builder desktop, waypoint sheet, vessel desktop, alerts desktop+mobile, settings. Run the fixture server (`PREVIEW_MOCK=1 npx vite --port 5199`) and the script; save to `/tmp/design-renders/v2-*.png`. Also capture `v2-before-*` for passages list, passage page and landing from a checkout of `claude/deploy` on another port so before/after pairs exist.
3. Look at every render you produce and fix what looks wrong before reporting (overlaps, truncation, orphaned labels, contrast). Do at least two rounds.
4. Final report: what changed per screen, the component inventory, anything left out and why, and the validation output. No em dashes in the report either.

## Order of work (so the core lands even if you run short)

1. Tokens, base CSS, ui primitives (button, segmented, section, stat, empty-state, dropdown menu), Shell + bottom tab bar, Settings page.
2. `plain.ts` with tests.
3. Passages list.
4. Passage page (sections 1 to 8), redirects, Full table page.
5. Weather map polish, builder, vessel, alerts, anchorage, comparison.
6. Renders, review rounds, report.
