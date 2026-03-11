import { Database, ExternalLink, RefreshCw, FileCode2, Scale, Leaf } from 'lucide-react';
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
      description: 'Miljøstyrelsens Arealregister indeholder data om alle virkemiddelprojekter, vandplaner og kvælstofreduktionsmål.',
      url: 'https://mars.mst.dk',
      urlLabel: 'mars.mst.dk',
    },
    {
      icon: FileCode2,
      title: 'Geodata (WFS)',
      description: 'Kortdata for vandoplande og kystvande hentes fra Miljøstyrelsens Web Feature Service og konverteres til TopoJSON.',
      url: 'https://miljoegis.mim.dk',
      urlLabel: 'miljoegis.mim.dk',
    },
    {
      icon: Scale,
      title: 'Den Grønne Trepart',
      description: 'Reduktionsmålene stammer fra aftalen om Grøn Trepart (2023), der fastsatte 12.776 ton kvælstof inden 2030.',
      url: 'https://www.fm.dk/nyheder/nyhedsarkiv/2023/december/groen-trepart/',
      urlLabel: 'Finansministeriet',
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
      explanation: 'Projekter gennemgår fire faser: Skitse → Vurderet → Godkendt → Anlagt. Kun anlagte projekter bidrager til kvælstofreduktionen.',
    },
    {
      label: 'Farveindeks (kort)',
      explanation: 'Kystvande farves efter fremskridt mod lokalt mål. Vandoplande farves efter relativ kvælstofreduktion sammenlignet med det mest aktive opland.',
    },
  ];

  return (
    <section className="w-full max-w-4xl mx-auto px-4 py-10 relative overflow-hidden">
      <div className="absolute right-0 bottom-4 opacity-[0.10] hidden lg:block">
        <NatureWatermark animal="deer" size={130} className="scale-x-[-1]" />
      </div>
      <div className="absolute left-2 top-10 opacity-[0.10] hidden md:block animate-gentle-sway">
        <NatureWatermark animal="butterfly" size={55} className="rotate-12" />
      </div>
      <div className="absolute right-1/4 top-6 opacity-[0.08] hidden lg:block">
        <NatureWatermark animal="eel" size={80} className="rotate-[25deg]" />
      </div>
      <div className="absolute left-8 bottom-20 opacity-[0.09] hidden md:block">
        <NatureWatermark animal="flounder" size={70} className="-rotate-6" />
      </div>
      <div className="absolute right-8 top-1/2 opacity-[0.07] hidden xl:block">
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
        {sources.map((source) => (
          <div key={source.title} className="bg-card rounded-xl border border-border p-5 hover:shadow-md transition-shadow">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
              <source.icon className="w-4.5 h-4.5 text-primary" />
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1.5">{source.title}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              {source.description}
            </p>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              <ExternalLink className="w-3 h-3" />
              {source.urlLabel}
            </a>
          </div>
        ))}
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
              <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground transition-colors decoration-primary/30">GitHub</a>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
