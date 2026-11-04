---
name: frontend-dashboard
description: >
  Frontend development policies for the Grøn Trepart Tracker dashboard. Use this skill whenever
  working on React components, TypeScript files in src/, Tailwind styling, the map view, charts,
  pillar cards, or any UI element of the dashboard. Also trigger when adding new dashboard sections,
  modifying how data is displayed, working with the pillar system, or touching anything in the
  src/components/ or src/lib/ directories. If someone mentions "the dashboard", "the frontend",
  "a component", "the map", or "how things look" — this skill applies.
---

# Frontend & Dashboard — Grøn Trepart Tracker

This skill codifies the UI patterns, component conventions, and display policies for the Grøn
Trepart Tracker frontend. The dashboard is a public-facing, open-source tool for tracking Denmark's
environmental progress — every design decision should serve transparency and clarity.

When this file and the code disagree, the code wins — then fix this file.

## Tech Stack

- **React 19** + **TypeScript 5.8** — note the app tsconfig is *not* strict (`strict: false`,
  `strictNullChecks: false`, `noImplicitAny: false`); write null-safe code anyway
- **Vite 8** for dev/build (dev server on port 8080)
- **Tailwind CSS 4** — CSS-first config: theme tokens live in `src/index.css` (`@theme inline`),
  there is no `tailwind.config.*`. Utility classes only, no custom CSS classes
- **shadcn/ui** (Radix primitives) in `src/components/ui/` for base components
- **react-router-dom 7** for routing
- **lucide-react** for icons (consistent line-icon style throughout)
- **recharts 3** for charts and data visualization
- **Leaflet** + **react-leaflet 5** for maps; **TopoJSON** for boundaries
- **Vitest 4** for tests (`npm test`); tests sit next to the code as `*.test.ts(x)`

Before any PR: `npm run typecheck` (`tsc --noEmit`), `npm run lint` and `npm test` must pass.

## Page Structure

| Route | Page | What it is |
|-------|------|------------|
| `/` | `Index.tsx` | National overview — no pillar pre-selected |
| `/:pillarSlug` | `Index.tsx` | Same page with one delmål selected (`/kvælstof`, `/lavbund`, …) |
| `/kommuner` | `KommunePage.tsx` | Kommune ranking + map |
| `/kommuner/:kommuneSlug` | `KommuneDetailPage.tsx` | One kommune (sections `#status`, `#kort`, `#projekter`) |
| `/videnscenter`, `/videnscenter/:articleSlug` | `VidenscenterPage.tsx` | Curated background articles from `content/videnscenter/` |
| `/data-og-metode` | `DataMetodePage.tsx` | Sources, quality and method (anchors `#datakilder`, `#kvalitet`, `#metode`, `#soejler`) |

`Index.tsx` renders, top to bottom: `StickyNav` → `HeroSection` → `DelmaalVaelgKort` (pick a
delmål) → the pillar chapters (`ChapterSection` with ids from `src/lib/chapters.ts`:
`delmaal`, `projekter`, `fremskrivning`, `geografi`, `co2`) → `DataSourceSection` → `Footer`.

### The hero: indsats vs. effekt (`src/lib/model.ts`)

Since v1.0 the front page separates two layers and never mixes them:

- **Indsats** — the three virkemidler treparten builds: skov, lavbund and kvælstof-vådområder
  (`buildMeasures`, rendered by `IndsatsRow`). Progress counts **anlagt only**.
- **Effekt** — klima, vandmiljø and natur (`buildEffectDomains`, rendered by `EffectRow`). Each
  effect has its own honest framing (`EffectReframe`: baseline-gap for natur, attribution for CO₂,
  ecological snapshot for kystvande).

`FlowConnectors` draws which virkemidler feed which effects. **Effects are never summed into one
number** — they are delayed and partly driven by things outside the agreement.

## The Pillar System

The dashboard is organized around 5 pillars (delmål). Understand the pillar system before touching
any component.

### Pillar Configuration (`src/lib/pillars.ts`)

```typescript
type PillarId = 'nitrogen' | 'extraction' | 'afforestation' | 'co2' | 'nature';

interface PillarConfig {
  id: PillarId;
  label: string;            // Danish display name, e.g. "Kvælstof"
  description: string;
  target: number | null;    // National target value
  unit: string;             // e.g. "ton N/år", "ha", "% reduktion"
  deadlineYear: number;     // Authoritative per-pillar deadline — do not use targets.deadline
  hasData: boolean;
  hasGeoBreakdown: boolean; // Whether map coloring is available
  hasMultipleLayers: boolean;
  defaultLayer: 'catchments' | 'coastal';
  accentColor: string;
  catchmentDataField: string;
  planDataField: string;
  stubMessage?: string;
  backgroundTint: string;
  watermarks: Animal[];     // Legacy — not rendered, see "Nature watermarks"
}
```

**Active pillar state** is managed via `PillarContext` and the `usePillar()` hook
(`{ activePillar, setActivePillar, config }`). `activePillar` is `null` on `/`. Components read it
from context instead of passing pillar IDs down the tree.

### Pillar Details

| Pillar | Slug | Target | Deadline | Color |
|--------|------|--------|----------|-------|
| Kvælstof (nitrogen) | `/kvælstof` | 12.776 ton N/år | 2027 | `#0d9488` (teal) |
| Lavbundsarealer (extraction) | `/lavbund` | 140.000 ha | 2030 | `#a16207` (amber) |
| Skovrejsning (afforestation) | `/skovrejsning` | 250.000 ha | 2045 | `#15803d` (green) |
| CO₂ | `/co2` | 70 % reduktion | 2030 | `#737373` (grey) |
| Beskyttet natur (nature) | `/natur` | 20 % beskyttet | 2030 | `#16a34a` (green) |

All five have `hasData: true`. CO₂ has no geographic breakdown (`stubMessage` explains this on the
map). Natur has no firm project deadline, so it gets no countdown.

Skovrejsning combines MARS with Klimaskovfonden and Naturstyrelsen projects (supplementary
sources) — always say so when showing a skov figure.

---

## Display Policies

### Phase-Aware Metrics (Non-Negotiable)

Progress counts only **anlagt** (established) projects. Whenever MARS pipeline data is shown, the
phase breakdown must be visible or one click away. Never show a single "75 % complete" without
making clear that most of it is forundersøgelse or tilsagn.

- Phase labels, colors and icons come from **`src/lib/phase-config.ts`** — the single source of
  truth. Do not hard-code phase colors in components.
- Phase order: skitse → forundersøgelse → etableringstilsagn → anlagt.
- **Stacked bars**: anlagt solid, tilsagn medium, forundersøgelse light.
- **Metric cards**: headline number + subtitle or tooltip with the breakdown.
- **Tables**: phase columns or a phase filter (`PhaseFilter`, `PhaseFilterPopover`).

### Source Attribution (Non-Negotiable)

Every number must be traceable to its source and method. Use `InfoTooltip`
(`src/components/InfoTooltip.tsx`) next to headline numbers:

```tsx
<InfoTooltip
  title="Hvad viser tallet?"
  content={<p>…plain-Danish explanation…</p>}
  source="MARS · Miljøstyrelsen"
  methodLink="#kvalitet"              // anchor on /data-og-metode
  articleLink="saadan-maaler-vi"      // slug in /videnscenter
/>
```

`DataSourceSection` at the bottom of the page carries the full source list.

Caveats use amber, not red (red implies error):

```tsx
<p className="text-[11px] text-amber-700/90 leading-relaxed italic flex gap-1.5">
  <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
  <span>{disclaimer}</span>
</p>
```

### Klimarådet

Where Klimarådet's status report assesses a delmål, show `KlimaraadetBadge` with the risk rating;
the data is in `data.national.klimaraadet`.

### Economy

The økonomi/finansiering section was taken out of v1.0. Do not reintroduce money figures on the
front page or pillar pages without a deliberate decision.

---

## Data Loading

Data lives in `public/data/` and is fetched at runtime, not bundled. Loaders in `src/lib/data.ts`
cache at module level:

- `loadDashboardData()` fetches **`dashboard-summary.json`** and normalizes it
  (`normalizeRawData`). It **fails loudly** if the file is missing — there is no fallback to the
  old `dashboard-data.json`, which the ETL no longer writes.
- `ensureDashboardProjectDetails()` lazily merges the ~10 MB `project-details.json`; call it only
  where project-level detail is needed, after the KPIs have rendered.
- Separate loaders exist for geometry, CO₂, coastal water status, Klimaskovfonden, Naturstyrelsen,
  kommune ranking/benchmark and more — reuse them rather than calling `fetch` directly.

Normalized national figures:

- `data.national.progress` — anlagt figures (`extractionAchievedHa`, `nitrogenAchievedT`, …).
- `data.national.pipelineScenarios` — cumulative scenarios `established` ⊂ `approved` ⊂
  `preliminary` ⊂ `all`. Use these instead of re-adding phases yourself.
- Time and pace helpers (`timeElapsedPct`, `projectEndPct`, `AGREEMENT_START`) are in
  `src/lib/projections.ts`. The agreement start is 24 June 2024.

`src/lib/national-consistency.test.ts` checks that the funnel, the fremskrivning and the headline
numbers agree on the live snapshot. Keep it passing.

---

## Component Conventions

### File Organization

```
src/
├── components/
│   ├── ui/                 # shadcn/ui base components (don't modify)
│   ├── fremskrivning/      # Fremskrivning card and charts
│   ├── kommune-*/          # Kommune detail, map and standings
│   └── *.tsx               # Page sections (HeroSection, IndsatsRow, DenmarkMap, …)
├── hooks/                  # usePageMeta, useScrollSpy, useFirstVisitHint, …
├── lib/
│   ├── pillars.ts          # Pillar configs + context
│   ├── model.ts            # Indsats/effekt model for the hero
│   ├── phase-config.ts     # Canonical MARS phases
│   ├── chapters.ts         # Section ids and headings
│   ├── permalink/          # Shareable URL state
│   ├── types.ts            # Dashboard data types
│   ├── data.ts             # Data loaders (with caching)
│   ├── projections.ts      # Time elapsed, pace, goal status
│   └── format.ts           # Danish number/date formatting
└── pages/
```

### Naming Conventions

- Components: PascalCase files and exports (`HeroSection.tsx`, `export function HeroSection()`)
- Utilities/hooks: camelCase (`usePillar`, `loadDashboardData`)
- Types: PascalCase interfaces (`DashboardData`, `Plan`, `Catchment`)
- Files in `src/lib/` use kebab-case (`phase-config.ts`, `kommune-ranking.ts`)

### Number Formatting

Use `src/lib/format.ts`: `formatDanishNumber` (da-DK, dot thousands, comma decimals) and
`formatDanishAmount` (one decimal below 10, so small real values never show as 0). For
percentages on cards use `formatPctHeadline` in `model.ts` (`"< 1%"` for small positive values).

### Typography

- Headings: **Fraunces** serif, set inline: `style={{ fontFamily: "'Fraunces', serif" }}`
- Body: **Manrope** (set globally in `src/index.css`)

Both are loaded from Google Fonts in `src/index.css`.

### Nature watermarks

Do **not** render `NatureWatermark` animal silhouettes. They were removed after user feedback
that they cluttered the numbers. The component file and the `watermarks` field in `pillars.ts`
are legacy leftovers. Keep decorative treatment to simple Lucide icons at very low opacity.

---

## Language & i18n

The dashboard UI is in **Danish**. All user-facing text must be in Danish:
- "Kvælstofreduktion" not "Nitrogen reduction"
- "Anlagt" not "Established"
- "Forundersøgelsestilsagn" not "Preliminary investigation"

Code comments, variable names, and documentation can be in English.

Common Danish terms:
- Vandoplan / Vandoplande = Catchment(s)
- Kystvand / Kystvande = Coastal water(s)
- Virkemiddel / Virkemidler = Mitigation measure(s)
- Lavbundsareal = Low-lying area (extraction/rewetting)
- Skovrejsning = Afforestation
- Fredskov = Protected forest (legal designation)
- Tilsagn = Grant/approval
- Kommune = Municipality

---

## Responsive Design

- **Mobile** (default): single column, simplified charts
- **Tablet** (`md:`): two-column card grids
- **Desktop** (`lg:` / `xl:`): full layout with map and detailed tables

No horizontal page scroll at 375 px. Map interactions must be touch-friendly; `MobileBottomSheet`
replaces side panels on small screens.

## Dark Mode

Tailwind's `dark:` variant is class-based (`@custom-variant dark (&:is(.dark *))`), and nothing
currently sets the `.dark` class — the site renders in light mode only. Still use semantic color
classes so a dark theme stays possible:
- `text-foreground` / `text-muted-foreground` (not `text-black` / `text-gray-500`)
- `bg-card` / `bg-muted` (not `bg-white` / `bg-gray-100`)
- `border-border` (not `border-gray-200`)

---

## URLs, Permalinks & SEO

### Routes

Pillar slugs map to IDs in **`src/lib/slugs.ts`** (`PILLAR_SLUGS`, `slugToPillar`). Danish words
in every URL segment for SEO. `/` is the overview; it does **not** redirect to a pillar.

### Permalink state (`src/lib/permalink/`)

All shareable view state goes through the permalink module — never read or write ad-hoc query
params in a component. `src/lib/permalink/schema.ts` is the source of truth for every key.

Structure: `{path}#{section}?{query}`. The hash is the scroll section (chapter id); query params
are omitted when they equal the default.

Main keys on national pages: `kort`, `overlag`, `faser`, `fuldskaerm`, `projektenhed`, `frem`,
`projekt` (`mars:<id>`, `ksf:<id>`, `nst:<id>`), plus panel ids `opland`, `plan`, `kystvand`,
`vandplan`. Kommune list: `sort`, `visning`, `region`. Legacy keys (`lag`, `bio`, `vns`, `fane`)
are decoded for old links but never written.

```
/lavbund#fremskrivning
/natur#geografi?overlag=section3,natura2000&fuldskaerm=1
/skovrejsning#geografi?faser=anlagt,foru&overlag=ksf,nst
/kommuner?sort=skov&visning=ansvar
/kommuner/aalborg#projekter
```

`RouteParamSanitizer` strips params that don't belong on the current route.

### Sharing

- `CopyLinkButton` (permalink module) — "Kopiér link" in `StickyNav`, `ProjectsSection`, the
  fremskrivning card and the kommune standings. Copies the full current view state.
- `ShareButton` — copy / X / LinkedIn popover, shown in the hero when a pillar is selected.

### SEO

- **`index.html`**: static OG/Twitter tags and JSON-LD (`WebSite` + `Dataset`) read by social
  scrapers. The static `<link rel="canonical">` and `og:url` point to the front page
  (`https://treparttracker.dk/`) — the same value `usePageMeta` sets for `/`.
- **`src/hooks/usePageMeta.ts`**: per-page title, description, OG tags and canonical; called by
  `Index`, `KommunePage`, `KommuneDetailPage` and `VidenscenterPage`.
- **`public/sitemap.xml`**: generated by `npm run build-sitemap` (`scripts/build-sitemap.mjs`) —
  overview, 5 pillars, data & metode, `/kommuner`, all 98 kommune pages and videnscenter articles,
  with `<lastmod>`. Runs as part of `npm run build`.
- **`public/robots.txt`**: `Allow: /` + sitemap.
- **`public/_redirects`**: `/* /index.html 200` so Cloudflare Pages serves the SPA on deep links.

### Adding a New Pillar (URL checklist)

1. Add the config to `PILLAR_CONFIGS` in `src/lib/pillars.ts`
2. Add the slug to `PILLAR_SLUGS` in `src/lib/slugs.ts` and to the slug list in
   `src/lib/permalink/compose.ts` (`resolveRouteContext`)
3. Add the pillar to `PILLARS` in `scripts/build-sitemap.mjs`
4. Add a description to `PILLAR_DESCRIPTIONS` in `src/pages/Index.tsx`
5. Update the JSON-LD `keywords` in `index.html` if relevant

---

## Adding a New Dashboard Section

1. **Create the component** in `src/components/` following existing patterns
2. **Use `usePillar()`** if the section is pillar-specific
3. **Load data** via `src/lib/data.ts` loaders
4. **Attribute the source** — `InfoTooltip` with source + method link at minimum
5. **Show the phase breakdown** if the data has phases (via `phase-config.ts`)
6. **Register a chapter** in `src/lib/chapters.ts` if it should be linkable by hash
7. **Put shareable state in the permalink module**, not in ad-hoc query params
8. **Test responsive** at 375 px and desktop
9. **Update the changelog** (`src/lib/changelog.json`, then `mise run changelog`) if users will see it
10. **Run** `npm run typecheck`, `npm run lint` and `npm test`

---

## TypeScript Types

The main types are in `src/lib/types.ts`. `DashboardData` is the **normalized** shape produced by
`normalizeRawData`, not the raw JSON — if the ETL adds a field to `dashboard-summary.json`, add it
to the raw handling in `data.ts` and to the types.

Key interfaces:
- `DashboardData` — normalized dashboard data
- `Plan` — a coastal water group plan (37 total)
- `Catchment` — a VP3 catchment area (23 total)
- `PipelineScenarioValues` — cumulative phase scenario per pillar
- `KommuneMetrics` — per-kommune aggregates
