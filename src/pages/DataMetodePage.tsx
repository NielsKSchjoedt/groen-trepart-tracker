import { useState, useRef, useEffect } from 'react';
import {
  Database, ExternalLink, ChevronDown, ChevronRight, RefreshCw,
  Shield, Leaf, TreePine, Landmark, Scale, FileCode2, AlertTriangle,
  BookOpen, GitBranch, Clock, Eye, Beaker, MapPin,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { ViewSwitcher } from '@/components/ViewSwitcher';
import { StickyNav } from '@/components/StickyNav';
import { Footer } from '@/components/Footer';
import { useQuery } from '@tanstack/react-query';
import { loadDashboardData } from '@/lib/data';
import { PipelineViz } from '@/components/PipelineViz';

const REPO_URL = 'https://github.com/NielsKSchjoedt/groen-trepart-tracker';

/** GitHub link helper pointing at the main branch. */
function ghLink(path: string): string {
  return `${REPO_URL}/tree/main/${path}`;
}

/* ------------------------------------------------------------------ */
/*  Collapsible Section                                                */
/* ------------------------------------------------------------------ */

interface CollapsibleProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Expandable/collapsible content section with chevron indicator.
 * Used for progressive disclosure of technical detail.
 *
 * @param title - Section heading
 * @param defaultOpen - Whether the section starts expanded (default false)
 * @param children - Content to show when expanded
 */
function Collapsible({ title, defaultOpen = false, children }: CollapsibleProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-border/50 rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors"
        aria-expanded={open}
      >
        <span className="text-sm font-semibold text-foreground">{title}</span>
        {open
          ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          : <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        }
      </button>
      {open && <div className="px-5 pb-5 space-y-3 text-sm text-muted-foreground leading-relaxed">{children}</div>}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Data Sources                                                       */
/* ------------------------------------------------------------------ */

interface DataSourceDef {
  icon: typeof Database;
  title: string;
  description: string;
  url: string;
  urlLabel: string;
  disclaimer: string;
  frequency: string;
  dataDir: string;
  fetchScript: string;
  pillars: string[];
}

const DATA_SOURCES: DataSourceDef[] = [
  {
    icon: Database,
    title: 'MARS API',
    description: 'Multifunktionel ArealRegistrering — alle virkemiddelprojekter, vandplaner og kvælstofreduktionsmål inkl. projektstatus. Drives af SGAV (Styrelsen for Grøn Arealomlægning og Vandmiljø). 5 endpoints: plans, projects, vos, metadata og master-data.',
    url: 'https://mars.sgav.dk',
    urlLabel: 'mars.sgav.dk',
    disclaimer: 'Projektdata opdeles efter fase: forundersøgelse, godkendt og anlagt. Kun anlagte projekter har realiseret effekt. REST API fundet via browser DevTools — ikke officielt dokumenteret.',
    frequency: 'Dagligt (GitHub Actions, 06:00 UTC)',
    dataDir: 'data/mars/',
    fetchScript: 'etl/fetch_mars.py',
    pillars: ['Kvælstof', 'Lavbund', 'Skovrejsning'],
  },
  {
    icon: FileCode2,
    title: 'Geodata (MiljøGIS WFS)',
    description: 'Kortdata for vandoplande, kystvande, projektforslag og projektområder fra Miljøstyrelsens Web Feature Service (OGC WFS 2.0). Bruges til kortvisning og geografisk kontekst.',
    url: 'https://miljoegis.mim.dk',
    urlLabel: 'miljoegis.mim.dk',
    disclaimer: 'Geometrier konverteres til TopoJSON med simplificering for webvisning. WFS-data opdateres ikke synkront med MARS — geometri kan halte efter projektstatus.',
    frequency: 'Dagligt (GitHub Actions)',
    dataDir: 'data/miljoegis/',
    fetchScript: 'etl/fetch_miljoegis.py',
    pillars: ['Kort', 'Alle søjler'],
  },
  {
    icon: Shield,
    title: 'Natura 2000',
    description: 'Beskyttede naturområder under EU\'s habitatdirektiv og fuglebeskyttelsesdirektiv (~250 lokaliteter). Hentes fra MiljøGIS WFS-lag natur:natura_2000_omraader.',
    url: 'https://miljoegis.mim.dk',
    urlLabel: 'miljoegis.mim.dk',
    disclaimer: 'Marine/terrestrisk opdeling er heuristisk (navnebaseret). Præcis opdeling kræver spatial overlay med kystlinje. Overlap med §3 estimeres konservativt (~30%).',
    frequency: 'Lokal kørsel (fetch_all.sh)',
    dataDir: 'data/natura2000/',
    fetchScript: 'etl/fetch_natura2000.py',
    pillars: ['Natur'],
  },
  {
    icon: Leaf,
    title: '§3-beskyttet natur',
    description: 'Alle §3-beskyttede naturarealer — heder, moser, enge, strandenge, overdrev, søer (~187.000 polygoner). Hentes pagineret fra natur:ais_par3 (10.000 pr. side).',
    url: 'https://miljoegis.mim.dk',
    urlLabel: 'miljoegis.mim.dk',
    disclaimer: '§3-arealer overlapper med Natura 2000. Samlet beskyttet areal korrigeres for estimeret overlap (~30%). Kun egenskaber (type + ha) hentes — ikke geometri.',
    frequency: 'Lokal kørsel (fetch_all.sh)',
    dataDir: 'data/section3/',
    fetchScript: 'etl/fetch_section3.py',
    pillars: ['Natur'],
  },
  {
    icon: TreePine,
    title: 'Skovdata & Klimaskovfonden',
    description: 'Fredskov (juridisk baseline, ~60.000 matrikler), digitalt skovkort 2022, og Klimaskovfondens projekter (210 skovrejsningsprojekter, ~2.300 ha) hentet live via WFS.',
    url: 'https://klimaskovfonden.dk/vores-standard/register',
    urlLabel: 'klimaskovfonden.dk',
    disclaimer: 'Klimaskovfonden-data hentes fra WFS (test.admin.gc2.io). Arealer beregnes fra polygongeometri (Shoelace-formel på WGS84). Fredskov er juridisk status, ikke faktisk trædække.',
    frequency: 'Lokal kørsel (fetch_all.sh)',
    dataDir: 'data/klimaskovfonden/',
    fetchScript: 'etl/fetch_klimaskovfonden.py',
    pillars: ['Skovrejsning', 'Lavbund'],
  },
  {
    icon: Landmark,
    title: 'Naturstyrelsen — statslig skovrejsning',
    description: 'Statslige skovrejsningsprojekter matchet fra Naturstyrelsens hjemmeside mod MiljøGIS WFS-geodata (skovdrift-lag). ~30 projekter med polygongeometri, ~4.100 ha.',
    url: 'https://naturstyrelsen.dk/ny-natur/skovrejsning/skovrejsningsprojekter/',
    urlLabel: 'naturstyrelsen.dk',
    disclaimer: 'Matching sker på generiske stednavne — ikke alle projekter kan matches til WFS-geometri. Sagsnumre indikerer årstal, men præcise tidsperioder er uklare.',
    frequency: 'Lokal kørsel (fetch_all.sh)',
    dataDir: 'data/naturstyrelsen-skov/',
    fetchScript: 'etl/fetch_naturstyrelsen_skov.py',
    pillars: ['Skovrejsning'],
  },
  {
    icon: Scale,
    title: 'Den Grønne Trepart (aftalen)',
    description: 'Reduktionsmålene fra aftalen om et Grønt Danmark (december 2023) — 12.776 ton N inden 2027, 140.000 ha lavbundsjorder inden 2030, 250.000 ha ny skov inden 2045.',
    url: 'https://regeringen.dk/aktuelt/publikationer-og-aftaletekster/aftale-om-et-groent-danmark/',
    urlLabel: 'regeringen.dk',
    disclaimer: 'Politisk aftale — målene kan ændres ved ny lovgivning. Dashboardet bruger de officielle mål som reference.',
    frequency: 'Statisk (aftale fra dec. 2023)',
    dataDir: '',
    fetchScript: '',
    pillars: ['Alle søjler'],
  },
  {
    icon: MapPin,
    title: 'DAWA (Dataforsyningen)',
    description: '98 kommuner med metadata, GeoJSON-grænser og reverse geocoding. Bruges til kommunefordeling af projekter og kortvisning.',
    url: 'https://api.dataforsyningen.dk',
    urlLabel: 'api.dataforsyningen.dk',
    disclaimer: 'CC0-licens. Administrative grænser stemmer ikke nødvendigvis overens med miljøgeografiske opdelinger.',
    frequency: 'Dagligt (GitHub Actions)',
    dataDir: 'data/dawa/',
    fetchScript: 'etl/fetch_dawa.py',
    pillars: ['Kommuner', 'Kort'],
  },
  {
    icon: Beaker,
    title: 'Danmarks Statistik',
    description: 'Arealregnskab (ARE207), skovstatistik (SKOV1), fondstilskud (FOND19) og tilskudsdata (TILSKUD2). CC BY 4.0-licens.',
    url: 'https://statistikbanken.dk',
    urlLabel: 'statistikbanken.dk',
    disclaimer: 'Årsdata — typisk 1–2 års forsinkelse. Bruges til kontekst og baseline, ikke realtidsovervågning.',
    frequency: 'Dagligt (GitHub Actions)',
    dataDir: 'data/dst/',
    fetchScript: 'etl/fetch_dst.py',
    pillars: ['Kontekst'],
  },
];

/* ------------------------------------------------------------------ */
/*  Data Quality Limitations                                           */
/* ------------------------------------------------------------------ */

interface QualityItem {
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
}

const QUALITY_ITEMS: QualityItem[] = [
  {
    title: 'Kvælstofreduktion er modelberegnet — ikke målt',
    description: 'Tal for kvælstofreduktion pr. projekt er beregnet af Miljøstyrelsen ud fra arealtype, virkemiddel og modelantagelser. Det er ikke faktisk målte koncentrationer i vandløb. NOVANA-overvågningsdata har ~12 måneders forsinkelse.',
    severity: 'high',
  },
  {
    title: 'Projektpipeline ≠ realiseret effekt',
    description: 'Hovedparten af rapporteret kvælstofreduktion er i forundersøgelsesfasen. Kun anlagte projekter har realiseret miljøeffekt. Der forventes en naturlig acceleration, men dropout er også muligt. Dashboardet tillader scenarievalg for at belyse dette.',
    severity: 'high',
  },
  {
    title: 'CO₂-data kun på overordnet niveau',
    description: 'CO₂-fremskrivninger stammer fra KF25 (Energistyrelsen), der rapporterer nationale sektortotaler. Vi har ikke initiativniveau-data til at plotte konkrete klimaprojekter. Concito/Klimaalliancen har kommunefordelte data, men de er ikke maskinlæsbart tilgængelige endnu.',
    severity: 'high',
  },
  {
    title: 'Skovrejsningsdata er fragmenteret',
    description: 'MARS har begrænset skovrejsningsdata (0 projekter i "NST Skovrejsning"-ordningen pt.). Data suppleres fra Klimaskovfonden (WFS) og Naturstyrelsen (matchet mod MiljøGIS). Matching sker på generiske stednavne — ikke alle projekter kan geolokeres præcist.',
    severity: 'medium',
  },
  {
    title: 'Natura 2000 / §3-overlap er estimeret',
    description: 'Natura 2000 og §3-beskyttede arealer overlapper betydeligt. Overlappet estimeres konservativt til ~30%, men det reelle overlap varierer pr. region og kræver spatial union-beregning (GIS) for præcis opgørelse.',
    severity: 'medium',
  },
  {
    title: 'Marine/terrestrisk klassificering er navnebaseret',
    description: 'Natura 2000-områder klassificeres som marine eller terrestriske ud fra stednavne (kattegat, skagerrak, vadehav osv.). Kystområder med blandet dækning kan fejlklassificeres. Kun terrestrisk areal tæller mod "20% beskyttet land"-målet.',
    severity: 'low',
  },
  {
    title: 'WFS-data og MARS er ikke synkroniserede',
    description: 'Miljøstyrelsens WFS opdateres på en anden kadence end MARS REST API. Geometridata kan halte efter projektstatusændringer.',
    severity: 'low',
  },
  {
    title: 'MARS REST API er ikke officielt dokumenteret',
    description: 'API-endpointet blev opdaget via browser DevTools. Det returnerer korrekte data, men der er ingen garanti for langvarig stabilitet eller bagudkompatibilitet. ETL-pipelinen håndterer fejl gracefully.',
    severity: 'medium',
  },
];

const SEVERITY_COLORS: Record<string, string> = {
  high: 'text-red-600 dark:text-red-400',
  medium: 'text-amber-600 dark:text-amber-400',
  low: 'text-blue-600 dark:text-blue-400',
};

const SEVERITY_LABELS: Record<string, string> = {
  high: 'Væsentligt forbehold',
  medium: 'Moderat usikkerhed',
  low: 'Mindre forbehold',
};

/* ------------------------------------------------------------------ */
/*  Pillar ↔ Source Matrix                                             */
/* ------------------------------------------------------------------ */

interface PillarSourceRow {
  pillar: string;
  accentColor: string;
  sources: string[];
  metric: string;
}

const PILLAR_MATRIX: PillarSourceRow[] = [
  { pillar: 'Kvælstof', accentColor: '#0d9488', sources: ['MARS API'], metric: 'Ton N reduceret (mål: 12.776 T)' },
  { pillar: 'Lavbund', accentColor: '#a16207', sources: ['MARS API', 'Klimaskovfonden'], metric: 'Hektar udtaget (mål: 140.000 ha)' },
  { pillar: 'Skovrejsning', accentColor: '#15803d', sources: ['MARS API', 'Klimaskovfonden', 'Naturstyrelsen', 'Fredskov WFS'], metric: 'Hektar ny skov (mål: 250.000 ha)' },
  { pillar: 'CO₂', accentColor: '#737373', sources: ['KF25 (Energistyrelsen)'], metric: '% reduktion ift. 1990 (mål: 70%)' },
  { pillar: 'Natur', accentColor: '#7c3aed', sources: ['Natura 2000 WFS', '§3 WFS'], metric: '% beskyttet landareal (mål: 20%)' },
];

/* ------------------------------------------------------------------ */
/*  Methodology Deep-dives                                              */
/* ------------------------------------------------------------------ */

const METHOD_SECTIONS = [
  {
    title: 'Faseklassificering (MARS projectStatus)',
    content: (
      <>
        <p>MARS-projekter har et numerisk <code>projectStatus</code>-felt der mappes til livscyklusfaser:</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>6</strong> → <code>preliminary</code> (Forundersøgelsestilsagn — foreløbig undersøgelse)</li>
          <li><strong>10</strong> → <code>approved</code> (Etableringstilsagn — godkendt til anlæg)</li>
          <li><strong>15</strong> → <code>established</code> (Anlagt — fysisk gennemført)</li>
          <li>Alle andre → <code>preliminary</code> (konservativ default)</li>
        </ul>
        <p>Denne klassificering er defineret i <a href={ghLink('etl/build_dashboard_data.py')} target="_blank" rel="noopener noreferrer" className="underline decoration-primary/30 hover:text-foreground">build_dashboard_data.py</a> og bruges konsekvent i hele dashboardet.</p>
      </>
    ),
  },
  {
    title: 'Lineær fremskrivning (projektion)',
    content: (
      <>
        <p>For kvælstof, lavbund og skovrejsning beregnes en lineær fremskrivning baseret på forholdet mellem tid brugt og fremskridt gjort:</p>
        <p className="font-mono bg-muted/50 rounded-lg p-3 text-xs">projectedPct = actualPct / timeElapsedFraction(deadlineYear)</p>
        <p>Tidsbrøken beregnes fra aftalens start (januar 2024) til deadline (f.eks. 2027 for kvælstof). For CO₂ bruges Energistyrelsens KF25-klimafremskrivning i stedet for lineær ekstrapolation.</p>
        <p>Kilde: <a href={ghLink('src/lib/projections.ts')} target="_blank" rel="noopener noreferrer" className="underline decoration-primary/30 hover:text-foreground">src/lib/projections.ts</a></p>
      </>
    ),
  },
  {
    title: 'Scenarievælger (pipeline-scenarier)',
    content: (
      <>
        <p>Dashboardet tilbyder fire scenarier for hvad der tælles som "opnået":</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Kun anlagte</strong> — konservativt; kun projekter der er fysisk gennemført</li>
          <li><strong>+ Godkendte</strong> — inkluderer projekter med etableringstilsagn</li>
          <li><strong>+ Forundersøgte</strong> — inkluderer alle med forundersøgelsestilsagn</li>
          <li><strong>Hele pipeline</strong> — al registreret aktivitet</li>
        </ul>
        <p>Hvert scenarie genberegner fremskrivningen så brugeren kan se, hvordan billedet ændrer sig hvis flere projekter realiseres.</p>
      </>
    ),
  },
  {
    title: 'Overlap-korrektion for beskyttet natur',
    content: (
      <>
        <p>Natura 2000 og §3-beskyttede arealer overlapper. Det totale beskyttede areal beregnes som:</p>
        <p className="font-mono bg-muted/50 rounded-lg p-3 text-xs">total = natura2000_terrestrisk + §3_total × (1 - overlapFaktor)</p>
        <p>Overlapfaktoren er sat til ~30% baseret på erfaringstal. En præcis beregning ville kræve spatial union af alle polygoner — en tung GIS-operation der ikke er implementeret endnu.</p>
      </>
    ),
  },
  {
    title: 'Navnematching (skovrejsning)',
    content: (
      <>
        <p>Naturstyrelsens skovrejsningsprojekter publiceres med generiske stednavne ("Vestskoven", "Aalborg Sydøst Skov" osv.). For at geolokere dem forsøger ETL-pipelinen at matche navne mod MiljøGIS WFS-laget <code>skovdrift:Naturstyrelsens arealoversigt</code>.</p>
        <p>Matching er fuzzy og ikke alle projekter kan knyttes til geometri. Ummatchede projekter tæller i totaler men vises ikke på kort.</p>
      </>
    ),
  },
  {
    title: 'Kommunefordeling (punkt-i-polygon)',
    content: (
      <>
        <p>Projekter med koordinater (centroider eller geometri) fordeles på kommuner via reverse geocoding fra DAWA API eller punkt-i-polygon test mod kommunepolygoner.</p>
        <p>Resultater caches i <code>data/geo-kommune-cache.json</code> for at undgå gentagne API-kald. Projekter der falder uden for kommunepolygoner (f.eks. havarealer) får ingen kommunetilknytning.</p>
        <p>Kilde: <a href={ghLink('etl/spatial_utils.py')} target="_blank" rel="noopener noreferrer" className="underline decoration-primary/30 hover:text-foreground">etl/spatial_utils.py</a></p>
      </>
    ),
  },
];

/* ------------------------------------------------------------------ */
/*  Page Component                                                     */
/* ------------------------------------------------------------------ */

/**
 * Top-level "Data og Metode" transparency page.
 * Documents all data sources, the ETL pipeline, data quality
 * limitations, methodology, and update frequency.
 *
 * Uses progressive disclosure: high-level overview is always visible,
 * technical detail is in collapsible sections. All sections have anchor
 * IDs for deep-linking from InfoTooltips in the dashboard.
 */
export default function DataMetodePage() {
  const sentinelRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['dashboard-data'],
    queryFn: loadDashboardData,
    staleTime: 5 * 60_000,
  });

  const fetchedAt = data?.fetchedAt ?? new Date().toISOString();
  const fetchedFormatted = new Date(fetchedAt).toLocaleDateString('da-DK', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const projectCount = data?.plans
    ? data.plans.reduce((a: number, p: { projectCount?: number }) => a + (p.projectCount ?? 0), 0)
    : '~1.200';
  const planCount = data?.plans?.length ?? 37;

  // Scroll to hash on mount (handles deep-links from InfoTooltips)
  useEffect(() => {
    if (window.location.hash) {
      const el = document.querySelector(window.location.hash);
      el?.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  return (
    <main className="min-h-screen bg-background">
      {/* Hero + ViewSwitcher */}
      <section className="w-full pt-10 pb-8 text-center">
        <ViewSwitcher />
        <h1
          className="text-3xl md:text-5xl font-bold tracking-tight text-foreground mb-3"
          style={{ fontFamily: "'Fraunces', serif" }}
        >
          Data og metode
        </h1>
        <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto leading-relaxed px-4">
          Fuld gennemsigtighed om, hvor data kommer fra, hvordan den behandles,
          og hvilke begrænsninger der er. Alt er open source — du kan selv verificere hvert tal.
        </p>
      </section>

      <div ref={sentinelRef} />
      <StickyNav sentinelRef={sentinelRef as React.RefObject<HTMLDivElement>} />

      <div className="max-w-4xl mx-auto px-4 pb-8 space-y-16">

        {/* ========== Quick Navigation ========== */}
        <nav className="flex flex-wrap gap-2 justify-center" aria-label="Spring til sektion">
          {[
            { href: '#datakilder', label: 'Datakilder' },
            { href: '#pipeline', label: 'Pipeline' },
            { href: '#soejler', label: 'Søjler & dataflow' },
            { href: '#kvalitet', label: 'Kvalitet' },
            { href: '#opdatering', label: 'Opdatering' },
            { href: '#metode', label: 'Metode' },
            { href: '#fremtid', label: 'Fremtid' },
            { href: '#docs', label: 'Dokumentation' },
          ].map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="px-3 py-1.5 rounded-lg border border-border/60 bg-muted/30 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* ========== 1. Læsevejledning ========== */}
        <section>
          <div className="p-5 rounded-xl bg-primary/5 border border-primary/10">
            <div className="flex items-start gap-3">
              <Eye className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="space-y-2 text-sm text-muted-foreground leading-relaxed">
                <p className="font-semibold text-foreground">Hvordan du læser denne side</p>
                <p>
                  Dashboardet viser Danmarks fremskridt mod de 5 hovedmål i den grønne trepart-aftale.
                  For hvert tal du ser, dokumenterer denne side: <strong>hvor data kommer fra</strong>,{' '}
                  <strong>hvordan det behandles</strong>, og <strong>hvilke forbehold der er</strong>.
                </p>
                <p>
                  Overordnede beskrivelser er altid synlige. Tekniske detaljer kan foldes ud under
                  "Metode og algoritmer" længere nede. Links til kildekode og rådata på GitHub
                  gør det muligt at verificere alt selv.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ========== 2. Datakilder ========== */}
        <section id="datakilder">
          <SectionHeader icon={Database} title="Datakilder" />
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Dashboardet henter data fra {DATA_SOURCES.length} offentlige kilder.
            Næsten alle fetchers er Python-scripts uden eksterne dependencies (kun stdlib). Undtagelser: <code>build_co2_data.py</code> kræver <code>openpyxl</code>, og <code>fetch_water_body_geometries.py</code> bruger <code>requests</code>.
            Rådata gemmes i git-versioneret <code>data/</code>-mappe.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {DATA_SOURCES.map((src) => (
              <div
                key={src.title}
                className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow flex flex-col"
              >
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                    <src.icon className="w-4.5 h-4.5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-foreground">{src.title}</h3>
                    <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" /> {src.frequency}
                    </p>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed mb-2">{src.description}</p>
                {src.disclaimer && (
                  <p className="text-[11px] text-amber-700/70 dark:text-amber-400/60 leading-relaxed mb-3 italic flex gap-1.5">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span>{src.disclaimer}</span>
                  </p>
                )}
                <div className="mt-auto space-y-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    {src.pillars.map((p) => (
                      <span key={p} className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-medium">
                        {p}
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-xs">
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-primary hover:text-primary/80 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> {src.urlLabel}
                    </a>
                    {src.dataDir && (
                      <a
                        href={ghLink(src.dataDir)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <GitBranch className="w-3 h-3" /> Rådata
                      </a>
                    )}
                    {src.fetchScript && (
                      <a
                        href={ghLink(src.fetchScript)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <FileCode2 className="w-3 h-3" /> Script
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ========== 3. Pipeline ========== */}
        <section id="pipeline">
          <SectionHeader icon={GitBranch} title="Data pipeline" />
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Data flyder fra offentlige API'er og WFS-tjenester, gennem Python ETL-scripts,
            til aggregerede JSON-filer, og videre til React-dashboardet. Hele kæden er
            versionskontrolleret i git.
          </p>
          <PipelineViz />
          <div className="mt-4 flex flex-wrap gap-3 text-xs text-muted-foreground">
            <a href={ghLink('etl/')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground transition-colors underline decoration-primary/30">
              <FileCode2 className="w-3 h-3" /> etl/ (alle scripts)
            </a>
            <a href={ghLink('data/')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground transition-colors underline decoration-primary/30">
              <GitBranch className="w-3 h-3" /> data/ (rådata)
            </a>
            <a href={ghLink('public/data/')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground transition-colors underline decoration-primary/30">
              <Database className="w-3 h-3" /> public/data/ (dashboard-filer)
            </a>
            <a href={ghLink('etl/build_dashboard_data.py')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 hover:text-foreground transition-colors underline decoration-primary/30">
              <FileCode2 className="w-3 h-3" /> build_dashboard_data.py
            </a>
          </div>
        </section>

        {/* ========== 4. Søjler og Dataflow ========== */}
        <section id="soejler">
          <SectionHeader icon={Leaf} title="Søjler og dataflow" />
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            De 5 søjler i dashboardet trækker data fra forskellige kilder.
            Denne matrix viser, hvilke datakilder der føder ind i hvilket mål.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-3 font-semibold text-foreground">Søjle</th>
                  <th className="text-left py-3 px-3 font-semibold text-foreground">Datakilder</th>
                  <th className="text-left py-3 px-3 font-semibold text-foreground">Metrik</th>
                </tr>
              </thead>
              <tbody>
                {PILLAR_MATRIX.map((row) => (
                  <tr key={row.pillar} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-3">
                      <span className="inline-flex items-center gap-2 font-semibold text-foreground">
                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: row.accentColor }} />
                        {row.pillar}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-muted-foreground">
                      {row.sources.join(', ')}
                    </td>
                    <td className="py-3 px-3 text-muted-foreground text-xs">{row.metric}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ========== 5. Datakvalitet og begrænsninger ========== */}
        <section id="kvalitet">
          <SectionHeader icon={AlertTriangle} title="Datakvalitet og begrænsninger" />
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Gennemsigtighed kræver ærlighed om begrænsninger. Herunder er de vigtigste
            forbehold du bør kende, når du læser tallene i dashboardet.
          </p>

          <div className="space-y-3">
            {QUALITY_ITEMS.map((item) => (
              <div
                key={item.title}
                className="p-4 rounded-xl bg-card border border-border/50 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start gap-3">
                  <AlertTriangle className={`w-4 h-4 flex-shrink-0 mt-0.5 ${SEVERITY_COLORS[item.severity]}`} />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-semibold text-foreground">{item.title}</p>
                      <span className={`text-[10px] font-medium ${SEVERITY_COLORS[item.severity]}`}>
                        {SEVERITY_LABELS[item.severity]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.description}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ========== 6. Opdateringsfrekvens ========== */}
        <section id="opdatering">
          <SectionHeader icon={RefreshCw} title="Opdateringsfrekvens" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="p-5 rounded-xl bg-card border border-border">
              <p className="text-sm font-semibold text-foreground mb-2">Automatisk (GitHub Actions)</p>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                Daglig kørsel kl. 06:00 UTC (08:00 dansk tid). Henter data fra
                MARS, DAWA, MiljøGIS, Danmarks Statistik og VanDa. Bygger dashboard-JSON
                og committer ændringer til git automatisk.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['MARS', 'DAWA', 'MiljøGIS', 'DST', 'VanDa'].map((s) => (
                  <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-700 dark:text-green-400 font-medium">
                    {s}
                  </span>
                ))}
              </div>
            </div>

            <div className="p-5 rounded-xl bg-card border border-border">
              <p className="text-sm font-semibold text-foreground mb-2">Manuel/lokal kørsel</p>
              <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                Tunge eller sjældent opdaterede kilder køres lokalt via{' '}
                <code>etl/fetch_all.sh</code> (12 fetchers + 2 builders). Inkluderer
                Natura 2000, §3, fredskov, Klimaskovfonden, Naturstyrelsen, KF25, geometrier og CO₂-data.
              </p>
              <div className="flex flex-wrap gap-1.5">
                {['Natura 2000', '§3', 'Fredskov', 'KSF', 'NST', 'KF25', 'Geometrier'].map((s) => (
                  <span key={s} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 font-medium">
                    {s}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border">
            <RefreshCw className="w-4 h-4 text-primary flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-foreground">Sidst opdateret</p>
              <p className="text-xs text-muted-foreground">{fetchedFormatted}</p>
            </div>
            <div className="ml-auto text-xs text-muted-foreground">
              <span className="font-semibold text-foreground">{projectCount}</span> projekter &middot;{' '}
              <span className="font-semibold text-foreground">{planCount}</span> vandplaner
            </div>
          </div>

          <p className="text-xs text-muted-foreground mt-3">
            Kørselsoversigt: <a href={ghLink('data/etl-log.json')} target="_blank" rel="noopener noreferrer" className="underline decoration-primary/30 hover:text-foreground">etl-log.json</a> &middot;
            GitHub Actions workflow: <a href={ghLink('.github/workflows/fetch-data.yml')} target="_blank" rel="noopener noreferrer" className="underline decoration-primary/30 hover:text-foreground">fetch-data.yml</a>
          </p>
        </section>

        {/* ========== 7. Metode og algoritmer ========== */}
        <section id="metode">
          <SectionHeader icon={Beaker} title="Metode og algoritmer" />
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Nedenfor er de vigtigste beregningsmæssige principper, der driver tallene i dashboardet.
            Fold en sektion ud for at se tekniske detaljer.
          </p>

          <div className="space-y-3">
            {METHOD_SECTIONS.map((ms) => (
              <Collapsible key={ms.title} title={ms.title}>
                {ms.content}
              </Collapsible>
            ))}
          </div>
        </section>

        {/* ========== 8. Fremtidige datakilder ========== */}
        <section id="fremtid">
          <SectionHeader icon={BookOpen} title="Fremtidige datakilder" />
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Projektet stræber løbende efter at udvide datagrundlaget. Her er de kilder,
            vi overvejer at integrere:
          </p>

          <div className="space-y-3">
            {[
              {
                name: 'Concito / Klimaalliancen — kommunefordelt CO₂',
                desc: 'Concito har 16 omstillingsindikatorer pr. kommune (inkl. drivhusgasudledning fra Energi- og CO₂-regnskabet). Indikator #12 (organiske jorde) og #13 (skov) overlapper direkte med vores søjler — god validerings­mulighed.',
                status: 'Identificeret — afventer maskinlæsbar adgang',
              },
              {
                name: 'VanDa API (OAuth2)',
                desc: 'Overfladevands-kemiske og biologiske målinger fra Danmarks Miljøportal. REST API med Swagger-dokumentation, men kræver OAuth2-registrering.',
                status: 'API identificeret — registrering påkrævet',
              },
              {
                name: 'MARS GeoServer (autentificeret)',
                desc: 'MiljøGIS-lag med projektgeometrier der kræver MARS-session. Ville give bedre geometridata end den nuværende fetch_geometries.py.',
                status: 'Kræver forhandling med SGAV',
              },
              {
                name: 'Energi- og CO₂-regnskabet (SparEnergi)',
                desc: 'Kommunefordelt drivhusgasregnskab fra Ea Energianalyse. Potentielt downloadbart fra sparenergi.dk — ~2 års forsinkelse.',
                status: 'Identificeret — format undersøges',
              },
              {
                name: 'LandbrugsGIS (Landbrugsstyrelsen)',
                desc: 'Markblokke, arealanvendelse og kvælstofretention. Frit downloadbare shapefiles fra landbrugsgeodata.fvm.dk.',
                status: 'Tilgængelig — ikke implementeret',
              },
            ].map((item) => (
              <div key={item.name} className="p-4 rounded-xl bg-card border border-border/50">
                <p className="text-sm font-semibold text-foreground mb-1">{item.name}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mb-2">{item.desc}</p>
                <p className="text-[11px] text-primary font-medium">{item.status}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ========== 9. Teknisk dokumentation ========== */}
        <section id="docs">
          <SectionHeader icon={FileCode2} title="Teknisk dokumentation" />
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            Projektet vedligeholder omfattende teknisk dokumentation i{' '}
            <a href={ghLink('docs/')} target="_blank" rel="noopener noreferrer" className="underline decoration-primary/30 hover:text-foreground">
              docs/
            </a>-mappen på GitHub. Denne bruges som arbejdsdokumentation under udviklingen.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { path: 'docs/domain/', label: 'Domæneviden', desc: 'Aftalens indhold, målsætninger, governance-struktur, geografi' },
              { path: 'docs/data-sources/', label: 'Datakilder', desc: 'MARS, MiljøGIS, DST, data provenance, data gaps' },
              { path: 'docs/architecture/', label: 'Arkitektur', desc: 'Arkitekturbeslutninger (ADR), datamodel, ETL-strategi' },
              { path: 'docs/references/', label: 'Referencer', desc: 'URL-oversigt, ordliste (da/en)' },
            ].map((doc) => (
              <a
                key={doc.path}
                href={ghLink(doc.path)}
                target="_blank"
                rel="noopener noreferrer"
                className="p-4 rounded-xl bg-card border border-border/50 hover:shadow-md transition-shadow group"
              >
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{doc.label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed mt-1">{doc.desc}</p>
                <p className="text-[11px] text-muted-foreground/60 mt-2 font-mono">{doc.path}</p>
              </a>
            ))}
          </div>
        </section>

        {/* ========== Open Source CTA ========== */}
        <section className="text-center p-8 rounded-2xl bg-primary/5 border border-primary/10">
          <h2 className="text-lg font-bold text-foreground mb-2" style={{ fontFamily: "'Fraunces', serif" }}>
            Alt er open source
          </h2>
          <p className="text-sm text-muted-foreground mb-4 max-w-lg mx-auto leading-relaxed">
            Al kode, data og dokumentation er frit tilgængeligt. Du kan verificere hvert tal,
            foreslå forbedringer, eller bygge videre på projektet.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-foreground text-background text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              <GitBranch className="w-4 h-4" /> GitHub
            </a>
            <a
              href={`${REPO_URL}/issues`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm font-semibold hover:bg-muted/50 transition-colors"
            >
              <AlertTriangle className="w-4 h-4" /> Rapportér fejl
            </a>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-border bg-background text-foreground text-sm font-semibold hover:bg-muted/50 transition-colors"
            >
              <Leaf className="w-4 h-4" /> Til dashboardet
            </Link>
          </div>
        </section>
      </div>

      <Footer fetchedAt={fetchedAt} />
    </main>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared Section Header                                               */
/* ------------------------------------------------------------------ */

/**
 * Consistent section header with icon and title.
 *
 * @param icon - Lucide icon component
 * @param title - Section heading text
 */
function SectionHeader({ icon: Icon, title }: { icon: typeof Database; title: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-2">
      <Icon className="w-5 h-5 text-primary" />
      <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
        {title}
      </h2>
    </div>
  );
}
