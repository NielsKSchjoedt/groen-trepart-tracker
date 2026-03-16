import { Database, ArrowRight, FileCode2, Monitor } from 'lucide-react';

const REPO_URL = 'https://github.com/NielsKSchjoedt/groen-trepart-tracker';

function ghLink(path: string): string {
  return `${REPO_URL}/tree/main/${path}`;
}

interface StageItem {
  label: string;
  detail: string;
  link?: string;
}

interface PipelineStage {
  title: string;
  icon: typeof Database;
  color: string;
  items: StageItem[];
}

const STAGES: PipelineStage[] = [
  {
    title: 'Datakilder',
    icon: Database,
    color: '#0d9488',
    items: [
      { label: 'MARS API', detail: '5 endpoints', link: 'https://mars.sgav.dk' },
      { label: 'MiljøGIS WFS', detail: 'Geodata', link: 'https://miljoegis.mim.dk' },
      { label: 'DAWA', detail: '98 kommuner', link: 'https://api.dataforsyningen.dk' },
      { label: 'Danmarks Statistik', detail: '4 tabeller', link: 'https://statistikbanken.dk' },
      { label: 'Natura 2000 / §3', detail: '~187.000 features' },
      { label: 'Skovdata', detail: 'KSF + NST + Fredskov' },
      { label: 'KF25', detail: 'CO₂-fremskrivning' },
    ],
  },
  {
    title: 'ETL (Python)',
    icon: FileCode2,
    color: '#a16207',
    items: [
      { label: 'fetch_mars.py', detail: 'Projekter + planer', link: ghLink('etl/fetch_mars.py') },
      { label: 'fetch_miljoegis.py', detail: 'Projektgeometrier', link: ghLink('etl/fetch_miljoegis.py') },
      { label: 'fetch_dawa.py', detail: 'Kommunegrænser', link: ghLink('etl/fetch_dawa.py') },
      { label: 'fetch_natura2000.py', detail: 'EU-beskyttelse', link: ghLink('etl/fetch_natura2000.py') },
      { label: 'fetch_section3.py', detail: '§3-arealer', link: ghLink('etl/fetch_section3.py') },
      { label: '+ 7 flere fetchers', detail: 'Se etl/', link: ghLink('etl/') },
    ],
  },
  {
    title: 'Aggregering',
    icon: Database,
    color: '#7c3aed',
    items: [
      { label: 'build_dashboard_data.py', detail: 'Samler alle kilder', link: ghLink('etl/build_dashboard_data.py') },
      { label: 'build_co2_data.py', detail: 'KF25 → JSON', link: ghLink('etl/build_co2_data.py') },
      { label: 'build_kommune_topojson.py', detail: 'GeoJSON → TopoJSON', link: ghLink('etl/build_kommune_topojson.py') },
    ],
  },
  {
    title: 'Dashboard-filer',
    icon: Database,
    color: '#15803d',
    items: [
      { label: 'dashboard-data.json', detail: 'Hoveddatasæt', link: ghLink('public/data/dashboard-data.json') },
      { label: 'co2-emissions.json', detail: 'CO₂-kurver', link: ghLink('public/data/co2-emissions.json') },
      { label: 'kommuner.topo.json', detail: 'Kommunekort', link: ghLink('public/data/kommuner.topo.json') },
      { label: 'project-geometries.json', detail: 'Projektpolygoner', link: ghLink('public/data/project-geometries.json') },
      { label: '+ 4 flere filer', detail: 'Se public/data/', link: ghLink('public/data/') },
    ],
  },
  {
    title: 'Frontend (React)',
    icon: Monitor,
    color: '#dc2626',
    items: [
      { label: 'src/lib/data.ts', detail: 'Data loader + cache', link: ghLink('src/lib/data.ts') },
      { label: 'src/lib/projections.ts', detail: 'Fremskrivninger', link: ghLink('src/lib/projections.ts') },
      { label: 'src/pages/Index.tsx', detail: 'Nationalt dashboard', link: ghLink('src/pages/Index.tsx') },
      { label: 'src/pages/KommunePage.tsx', detail: 'Kommunekort', link: ghLink('src/pages/KommunePage.tsx') },
    ],
  },
];

/**
 * Visual data pipeline diagram showing how data flows from external
 * sources through ETL scripts to dashboard JSON and into the React
 * frontend. Each stage is a card with clickable links to GitHub.
 *
 * Uses a horizontal layout on desktop, vertical on mobile.
 *
 * @example <PipelineViz />
 */
export function PipelineViz() {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <div className="flex flex-col lg:flex-row items-stretch gap-3 lg:gap-1 min-w-0">
        {STAGES.map((stage, i) => {
          const Icon = stage.icon;
          return (
            <div key={stage.title} className="flex items-stretch gap-1 min-w-0 flex-1 lg:max-w-none">
              <div className="flex-1 min-w-[180px] rounded-xl border border-border bg-card p-4 hover:shadow-sm transition-shadow">
                <div className="flex items-center gap-2 mb-3">
                  <div
                    className="w-7 h-7 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: stage.color + '18' }}
                  >
                    <Icon className="w-3.5 h-3.5" style={{ color: stage.color }} />
                  </div>
                  <p className="text-xs font-bold text-foreground">{stage.title}</p>
                </div>
                <ul className="space-y-1.5">
                  {stage.items.map((item) => (
                    <li key={item.label} className="text-[11px] leading-tight">
                      {item.link ? (
                        <a
                          href={item.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-medium text-foreground hover:text-primary transition-colors"
                        >
                          {item.label}
                        </a>
                      ) : (
                        <span className="font-medium text-foreground">{item.label}</span>
                      )}
                      <span className="text-muted-foreground/70 ml-1">— {item.detail}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {i < STAGES.length - 1 && (
                <div className="hidden lg:flex items-center justify-center w-5 flex-shrink-0">
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/40" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
