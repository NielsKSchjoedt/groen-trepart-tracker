import { Database, ExternalLink, RefreshCw, FileCode2, Scale, Leaf, TreePine, Landmark, Shield, MapPin, AlertTriangle } from 'lucide-react';
import { NatureWatermark } from './NatureWatermark';

interface DataSourceSectionProps {
  fetchedAt: string;
}

export function DataSourceSection({ fetchedAt }: DataSourceSectionProps) {
  const date = new Date(fetchedAt);
  const formatted = date.toLocaleDateString('da-DK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const sources = [
    {
      icon: Database,
      title: 'MARS API',
      description: 'Multifunktionel ArealRegistrering — alle virkemiddelprojekter, vandplaner og kvælstofreduktionsmål inkl. projektstatus. Drives af SGAV (Styrelsen for Grøn Arealomlægning og Vandmiljø).',
      url: 'https://mars.sgav.dk',
      urlLabel: 'mars.sgav.dk',
      disclaimer: 'Projektdata opdeles efter fase: forundersøgelse, godkendt og anlagt. Kun anlagte projekter har realiseret effekt.',
    },
    {
      icon: FileCode2,
      title: 'Geodata (WFS)',
      description: 'Kortdata for vandoplande og kystvande fra Miljøstyrelsens Web Feature Service.',
      url: 'https://miljoegis.mim.dk',
      urlLabel: 'miljoegis.mim.dk',
      disclaimer: 'Geometrier konverteres til TopoJSON med simplificering for webvisning.',
    },
    {
      icon: Shield,
      title: 'Natura 2000',
      description: 'Beskyttede naturområder under EU\'s habitatdirektiv og fuglebeskyttelsesdirektiv (~250 lokaliteter).',
      url: 'https://miljoegis.mim.dk',
      urlLabel: 'miljoegis.mim.dk',
      disclaimer: 'Marine/terrestrisk opdeling er heuristisk (navnebaseret). Præcis opdeling kræver spatiel overlay med kystlinje.',
    },
    {
      icon: Leaf,
      title: '§3-beskyttet natur',
      description: 'Alle §3-beskyttede naturarealer — heder, moser, enge, strandenge, overdrev, søer (~187.000 polygoner).',
      url: 'https://miljoegis.mim.dk',
      urlLabel: 'miljoegis.mim.dk',
      disclaimer: '§3-arealer overlapper med Natura 2000. Samlet beskyttet areal korrigeres for estimeret overlap (~30%).',
    },
    {
      icon: TreePine,
      title: 'Skovdata & Klimaskovfonden',
      description: 'Fredskov (juridisk baseline, ~60.000 matrikler), digitalt skovkort 2022, og Klimaskovfondens projekter (210 skovrejsningsprojekter, ~2.300 ha) hentet live via WFS.',
      url: 'https://klimaskovfonden.dk/vores-standard/register',
      urlLabel: 'klimaskovfonden.dk',
      disclaimer: 'Klimaskovfonden-data hentes fra WFS (test.admin.gc2.io). Arealer beregnes fra polygongeometri.',
    },
    {
      icon: Landmark,
      title: 'Naturstyrelsen — statslig skovrejsning',
      description: 'Statslige skovrejsningsprojekter matchet fra Naturstyrelsens hjemmeside mod MiljøGIS WFS-geodata (skovdrift-lag). ~30 projekter med polygongeometri, ~4.100 ha.',
      url: 'https://naturstyrelsen.dk/ny-natur/skovrejsning/skovrejsningsprojekter/',
      urlLabel: 'naturstyrelsen.dk',
      disclaimer: 'MARS har en "NST Skovrejsning"-tilskudsordning (0 projekter pt.) — ETL overvåger for fremtidige data. Ikke alle projekter er matchet med WFS.',
    },
    {
      icon: Scale,
      title: 'Den Grønne Trepart',
      description: 'Reduktionsmålene fra aftalen om et Grønt Danmark (2024) — 12.776 ton N inden 2030, 250.000 ha ny skov inden 2045.',
      url: 'https://regeringen.dk/aktuelt/publikationer-og-aftaletekster/aftale-om-et-groent-danmark/',
      urlLabel: 'regeringen.dk',
      disclaimer: 'Politisk aftale — målene kan ændres ved ny lovgivning.',
    },
  ];

  const metrics = [
    {
      label: 'Kvælstofreduktion',
      explanation: 'Ton kvælstof reduceret via virkemiddelprojekter (vådområder, lavbundsarealer, minivådområder m.fl.). Beregnet af Miljøstyrelsen baseret på konkrete projektdata.',
    },
    {
      label: 'Fremskridt (%)',
      explanation: 'Andelen af det nationale mål (12.776 ton) der er opnået. For kystvande vises det lokale mål fra vandplanen.',
    },
    {
      label: 'Projektpipeline',
      explanation: 'Projekter gennemgår faser: Forundersøgelsestilsagn → Etableringstilsagn → Anlagt. Kun anlagte projekter har realiseret miljøeffekt — øvrige er planlagte eller under vurdering.',
    },
    {
      label: 'Beskyttet natur',
      explanation: 'Natura 2000 (EU-beskyttelse) og §3-arealer (national beskyttelse) er de to hoveddatasæt. Overlap korrigeres konservativt. Målet er 20% beskyttet landareal.',
    },
    {
      label: 'Farveindeks (kort)',
      explanation: 'Kystvande farves efter fremskridt mod lokalt mål. Vandoplande farves efter relativ kvælstofreduktion sammenlignet med det mest aktive opland.',
    },
  ];

  return (
    <section className="w-full max-w-4xl mx-auto px-4 py-10 relative overflow-hidden">
      <div className="absolute right-0 bottom-4 opacity-[0.10] hidden lg:block pointer-events-none">
        <NatureWatermark animal="deer" size={130} className="scale-x-[-1]" />
      </div>
      <div className="absolute left-2 top-10 opacity-[0.10] hidden md:block animate-gentle-sway pointer-events-none">
        <NatureWatermark animal="butterfly" size={55} className="rotate-12" />
      </div>
      <div className="absolute right-1/4 top-6 opacity-[0.08] hidden lg:block pointer-events-none">
        <NatureWatermark animal="eel" size={80} className="rotate-[25deg]" />
      </div>
      <div className="absolute left-8 bottom-20 opacity-[0.09] hidden md:block pointer-events-none">
        <NatureWatermark animal="flounder" size={70} className="-rotate-6" />
      </div>
      <div className="absolute right-8 top-1/2 opacity-[0.07] hidden xl:block pointer-events-none">
        <NatureWatermark animal="hedgehog" size={65} />
      </div>
      <div className="flex items-center gap-2.5 mb-2">
        <Database className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
          Om data & metode
        </h2>
      </div>
      <p className="text-sm text-muted-foreground mb-8">
        Vi tror på fuld gennemsigtighed. Her er præcis hvad du ser, og hvor det kommer fra.
      </p>

      {/* Data sources */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
        {sources.map((source) => (
          <div key={source.title} className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow flex flex-col">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
              <source.icon className="w-4.5 h-4.5 text-primary" />
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1.5">{source.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-2">
              {source.description}
            </p>
            {source.disclaimer && (
              <p className="text-[11px] text-amber-700/70 dark:text-amber-400/60 leading-relaxed mb-3 italic flex gap-1.5">
                <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                <span>{source.disclaimer}</span>
              </p>
            )}
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors mt-auto"
            >
              <ExternalLink className="w-3 h-3" />
              {source.urlLabel}
            </a>
          </div>
        ))}
      </div>

      {/* Phase awareness note */}
      <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 mb-8">
        <div className="flex gap-2.5 items-start">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">Om projektfaser og dataforbehold</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Alle projekttal opdeles efter fase: <strong>forundersøgelse</strong> (ansøgt, ikke godkendt),{' '}
              <strong>godkendt</strong> (tilsagn givet, ikke bygget) og <strong>anlagt</strong> (faktisk gennemført).
              Kun anlagte projekter har realiseret miljøeffekt. Tallene kan afvige fra officielle opgørelser pga.
              tidsforskel i dataopdateringer. Al data er offentligt tilgængelig og kan verificeres via kilderne ovenfor.
            </p>
          </div>
        </div>
      </div>

      {/* Metric explanations */}
      <h3
        className="text-base font-bold text-foreground mb-4"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        Hvad betyder tallene?
      </h3>
      <div className="space-y-3 mb-8">
        {metrics.map((m) => (
          <div key={m.label} className="flex gap-3 p-3.5 rounded-lg bg-muted/40 border border-border/50">
            <div className="w-1.5 rounded-full bg-primary/30 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-foreground mb-0.5">{m.label}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{m.explanation}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Update info */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-card border border-border">
        <div className="flex items-center gap-2.5">
          <RefreshCw className="w-4 h-4 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Sidst opdateret</p>
            <p className="text-xs text-muted-foreground">{formatted}</p>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <Leaf className="w-4 h-4 text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Open source</p>
            <p className="text-xs text-muted-foreground">
              Al kode og data er frit tilgængeligt på{' '}
              <a href="https://github.com/NielsKSchjoedt/groen-trepart-tracker" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors decoration-primary/30">GitHub</a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
