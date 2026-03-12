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

## Tech Stack

- **React 18** + **TypeScript 5.8** (strict mode)
- **Vite 5** for dev/build
- **Tailwind CSS 3.4** for styling (utility-first, no custom CSS files)
- **shadcn/ui** (Radix primitives) for base components — Button, Card, Tabs, Dialog, etc.
- **lucide-react** for icons (consistent line-icon style throughout)
- **recharts** for charts and data visualization
- **Leaflet** + **react-leaflet** for maps
- **TopoJSON** for geographic boundary data (simplified for web)

TypeScript compilation: `npx tsc --noEmit` — must pass clean before any PR.

## The Pillar System

The dashboard is organized around 5 environmental pillars. The pillar system is the backbone of the
UI architecture — understand it before touching any component.

### Pillar Configuration (`src/lib/pillars.ts`)

```typescript
type PillarId = 'nitrogen' | 'extraction' | 'afforestation' | 'co2' | 'nature';

// Each pillar has:
interface PillarConfig {
  id: PillarId;
  label: string;          // Danish display name (e.g., "Kvælstof")
  target: number | null;  // National target value
  unit: string;           // Unit label (e.g., "ton N/år")
  deadlineYear: number;   // Target year
  hasData: boolean;       // Whether ETL pipeline provides data
  hasGeoBreakdown: boolean; // Whether map view is available
  accentColor: string;    // Hex color for this pillar
  watermarkAnimal: string; // Nature illustration ("eel", "hedgehog", etc.)
  // ... more fields
}
```

**Active pillar state** is managed via `PillarContext` and the `usePillar()` hook. Components that
need to know which pillar is selected import `usePillar()` — they don't pass pillar IDs as props
through the tree.

### Pillar-Specific Details

| Pillar | Target | Deadline | Color | Data Status |
|--------|--------|----------|-------|-------------|
| Kvælstof (Nitrogen) | 13,780 ton N/år | 2027 | `#0d9488` (teal) | ✅ Full data |
| Lavbundsarealer (Extraction) | 140,000 ha | 2030 | `#b45309` (amber) | ✅ Full data |
| Skovrejsning (Afforestation) | 250,000 ha | 2045 | `#15803d` (green) | ✅ Full data |
| CO₂ | 1,800,000 ton CO₂e/år | 2030 | `#6366f1` (indigo) | ❌ No data yet |
| Natur (Nature) | null (20% target) | 2030 | `#7c3aed` (violet) | ✅ Partial |

Pillars without data (`hasData: false`) display stub/placeholder content. The CO₂ pillar currently
has no data source — it shows a "data kommer snart" message.

---

## Display Policies

### Phase-Aware Metrics (Non-Negotiable)

Whenever displaying progress data from MARS, the phase breakdown must be visible or accessible.
The user should never see a single "27% complete" without understanding that most of that is from
projects still in investigation.

**Patterns for showing phases:**
- **Progress bars**: Use stacked segments (established → approved → preliminary) with distinct
  visual treatment. Established is solid, approved is medium opacity, preliminary is low opacity.
- **Metric cards**: Show the headline number but include a subtitle or tooltip breaking it down.
- **Tables**: Include phase columns or a phase filter.

### Source Attribution (Non-Negotiable)

Every data visualization must be traceable to its source. The `DataSourceSection` component at the
bottom of the page provides the detailed breakdown, but individual sections should also carry
lightweight attribution.

**Pattern — disclaimer rendering:**
```tsx
{disclaimer && (
  <p className="text-[11px] text-amber-700/70 dark:text-amber-400/60 leading-relaxed italic flex gap-1.5">
    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
    <span>{disclaimer}</span>
  </p>
)}
```

Use amber tones for caveats/disclaimers, not red (which implies error).

### Data Source Cards

Follow the `DataSourceSection.tsx` pattern for source cards:
```tsx
<div className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow flex flex-col">
  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
    <SourceIcon className="w-4.5 h-4.5 text-primary" />
  </div>
  <h3 className="text-sm font-bold text-foreground mb-1.5">{title}</h3>
  <p className="text-xs text-muted-foreground leading-relaxed mb-2">{description}</p>
  {/* Disclaimer in amber */}
  <a href={url} target="_blank" rel="noopener noreferrer"
     className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 mt-auto">
    <ExternalLink className="w-3 h-3" />
    {urlLabel}
  </a>
</div>
```

---

## Component Conventions

### File Organization

```
src/
├── components/
│   ├── ui/          # shadcn/ui base components (don't modify these)
│   ├── HeroSection.tsx
│   ├── PillarCards.tsx
│   ├── DenmarkMap.tsx
│   └── ...
├── lib/
│   ├── pillars.ts   # Pillar configs + context
│   ├── types.ts     # TypeScript interfaces for dashboard data
│   ├── data.ts      # Data loading utilities (with caching)
│   ├── format.ts    # Number/date formatting helpers
│   └── utils.ts     # General utilities
└── pages/
    └── Index.tsx     # Main page layout
```

### Naming Conventions

- Components: PascalCase files and exports (`HeroSection.tsx`, `export function HeroSection()`)
- Utilities/hooks: camelCase (`usePillar`, `loadDashboardData`)
- Types: PascalCase interfaces (`DashboardData`, `Plan`, `Catchment`)
- CSS classes: Tailwind utilities only — no custom CSS classes

### Data Loading Pattern

Data is loaded via utility functions in `src/lib/data.ts` that cache at the module level:

```typescript
let dashboardDataCache: DashboardData | null = null;

export async function loadDashboardData(): Promise<DashboardData> {
  if (dashboardDataCache) return dashboardDataCache;
  const resp = await fetch('/data/dashboard-data.json');
  dashboardDataCache = await resp.json();
  return dashboardDataCache;
}
```

Data files live in `public/data/` and are fetched at runtime — not bundled.

### Typography

Headers use the `Fraunces` serif font:
```tsx
<h2 style={{ fontFamily: "'Fraunces', serif" }}>Section Title</h2>
```

Body text uses the system default (Tailwind's `font-sans`).

### Nature Watermarks

The dashboard includes subtle nature illustrations as decorative elements. These use the
`NatureWatermark` component with animal variants: `deer`, `butterfly`, `eel`, `flounder`,
`hedgehog`, `frog`, `dragonfly`.

```tsx
<div className="absolute right-0 bottom-4 opacity-[0.10] hidden lg:block">
  <NatureWatermark animal="deer" size={130} className="scale-x-[-1]" />
</div>
```

These are purely decorative — keep opacity very low (0.07–0.10) and hide on smaller screens.

---

## Language & i18n

The dashboard UI is in **Danish**. All user-facing text must be in Danish:
- "Kvælstofreduktion" not "Nitrogen reduction"
- "Fremskridt" not "Progress"
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

The dashboard targets three breakpoints:
- **Mobile** (`sm:`): Single column, simplified charts, hidden watermarks
- **Tablet** (`md:`): Two-column grid for cards, basic watermarks
- **Desktop** (`lg:` / `xl:`): Full layout with map, all watermarks, detailed tables

Map interactions are touch-friendly. Charts use responsive containers.

---

## Dark Mode

The project uses Tailwind's dark mode with CSS variables. Use semantic color classes:
- `text-foreground` / `text-muted-foreground` (not `text-black` / `text-gray-500`)
- `bg-card` / `bg-muted` (not `bg-white` / `bg-gray-100`)
- `border-border` (not `border-gray-200`)

Dark mode overrides use the `dark:` prefix: `dark:text-amber-400/60`.

---

---

## URL Structure & SEO

### URL Design Principles

The site uses path-based pillar routing combined with query params for sub-state.
Danish words are used in all URL segments to maximise SEO relevance for Danish queries.

### Pillar Routes

| Pillar | Path | Internal ID |
|--------|------|-------------|
| Kvælstof (nitrogen) | `/kvælstof` | `nitrogen` |
| Lavbundsarealer (extraction) | `/lavbund` | `extraction` |
| Skovrejsning (afforestation) | `/skovrejsning` | `afforestation` |
| CO₂ | `/co2` | `co2` |
| Beskyttet natur | `/natur` | `nature` |

`/` redirects to `/kvælstof` (the default, data-richest pillar).

The slug ↔ pillar ID mapping lives in **`src/lib/slugs.ts`**.
The routes are declared in **`src/App.tsx`** as `/:pillarSlug`.
`Index.tsx` reads the slug via `useParams()` and derives `activePillar`.

### Query Parameters

Sub-state that should survive a page share is encoded as query params.
Pillar navigation (`navigate('/skovrejsning')`) intentionally drops all params so each
pillar view starts clean.

| Param | Component | Meaning | Example |
|-------|-----------|---------|---------|
| `lag` | DenmarkMap | Map layer — `kyst` = coastal sub-catchments | `?lag=kyst` |
| `opland` | DenmarkMap | Open catchment detail panel (value = `nameNormalized`) | `?opland=bornholm` |
| `plan` | DenmarkMap | Open coastal plan detail panel (value = plan `id`) | `?plan=23` |
| `kystvand` | DenmarkMap | Open water-body quality panel (value = water body name) | `?kystvand=Odense+Fjord` |
| `vandplan` | DataTable | Expand a table row (value = plan `id`) | `?vandplan=23` |

All components use `useSearchParams()` from react-router-dom. Use the functional
update form to avoid race conditions:
```typescript
setSearchParams((prev) => {
  const next = new URLSearchParams(prev);
  next.set('opland', catchment.nameNormalized);
  return next;
});
```

### Shareable URL Examples

```
/kvælstof                                    → Nitrogen overview
/kvælstof?lag=kyst                           → Nitrogen, coastal layer
/kvælstof?opland=bornholm                    → Nitrogen, Bornholm catchment panel open
/kvælstof?plan=23                            → Nitrogen, coastal plan 23 panel open
/kvælstof?vandplan=23                        → Nitrogen, plan 23 expanded in table
/lavbund?opland=randers-fjord                → Extraction, specific catchment panel
```

### Cloudflare Pages SPA Routing

`public/_redirects` contains a single catch-all rule:
```
/*  /index.html  200
```
This serves `index.html` for every path (200, not 301/302), letting React Router
handle routing client-side. **Without this file, navigating directly to `/skovrejsning`
would return a 404 from Cloudflare.**

### SEO Implementation

**`index.html`** (static defaults — read by social scrapers at share time):
- Full OG tags: `og:title`, `og:description`, `og:url`, `og:image`, `og:locale`, `og:site_name`
- Twitter card tags
- JSON-LD structured data: `WebSite` + `Dataset` schemas
- `<link rel="canonical">` pointing to `/kvælstof`

**`src/hooks/usePageMeta.ts`** (dynamic updates — read by Googlebot after JS execution):
- Updates `document.title`, `meta[name="description"]`, OG tags, and canonical link
  based on the active pillar
- Called once in `Index.tsx` with pillar-specific titles and descriptions

**`public/sitemap.xml`**: Lists all 5 pillar URLs with `changefreq` and `priority`.

**`public/robots.txt`**: `Allow: /` + `Sitemap:` directive pointing to sitemap.xml.

### Adding a New Pillar (URL checklist)

1. Add slug to `PILLAR_SLUGS` in `src/lib/slugs.ts`
2. Add pillar description to `PILLAR_DESCRIPTIONS` in `src/pages/Index.tsx`
3. Add `<url>` entry to `public/sitemap.xml`
4. Update the JSON-LD `keywords` in `index.html` if relevant

### Share Button

`src/components/ShareButton.tsx` renders a pill button in the HeroSection that opens
a small popover with three options: copy URL, share on X, share on LinkedIn.
It reads `window.location.href` directly so the shared URL always reflects the current
pillar and all active query params.

---

## Adding a New Dashboard Section

When adding a new visualization or section:

1. **Create the component** in `src/components/` following existing patterns
2. **Use `usePillar()`** if the section is pillar-specific
3. **Load data** via `src/lib/data.ts` utilities
4. **Include source attribution** — at minimum a small disclaimer text; ideally link to the source
5. **Show phase breakdown** if the data has phases
6. **Test dark mode** — check both themes
7. **Test responsive** — verify mobile, tablet, desktop
8. **Run TypeScript check**: `npx tsc --noEmit`

---

## TypeScript Types

The main types are in `src/lib/types.ts`. Note that these types may lag behind changes to
`dashboard-data.json` — if you've updated the ETL pipeline to add new fields, update the types too.

Key interfaces:
- `DashboardData` — top-level dashboard JSON structure
- `Plan` — a coastal water group plan (37 total)
- `Catchment` — a VP3 catchment area (23 total)
- `ProjectCounts` — project count breakdown
- `MitigationMeasure` — individual mitigation measure/project type
