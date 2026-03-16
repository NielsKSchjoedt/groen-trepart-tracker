import { Database, RefreshCw, Leaf, AlertTriangle, BookOpen } from 'lucide-react';
import { Link } from 'react-router-dom';
import { NatureWatermark } from './NatureWatermark';

interface DataSourceSectionProps {
  fetchedAt: string;
}

/**
 * Compact "Om data & metode" section displayed at the bottom of the
 * national dashboard. Shows key caveats, last-updated time, and a
 * prominent link to the full /data-og-metode transparency page.
 *
 * Previously this component contained the full source list and metric
 * explanations — those now live on the dedicated page to avoid
 * duplicating content.
 *
 * @param fetchedAt - ISO timestamp of the most recent data fetch
 *
 * @example
 * <DataSourceSection fetchedAt={data.fetchedAt} />
 */
export function DataSourceSection({ fetchedAt }: DataSourceSectionProps) {
  const date = new Date(fetchedAt);
  const formatted = date.toLocaleDateString('da-DK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <section className="w-full max-w-4xl mx-auto px-4 py-10 relative overflow-hidden">
      <div className="absolute right-0 bottom-4 opacity-[0.10] hidden lg:block pointer-events-none">
        <NatureWatermark animal="deer" size={130} className="scale-x-[-1]" />
      </div>
      <div className="absolute left-2 top-10 opacity-[0.10] hidden md:block animate-gentle-sway pointer-events-none">
        <NatureWatermark animal="butterfly" size={55} className="rotate-12" />
      </div>

      <div className="flex items-center gap-2.5 mb-2">
        <Database className="w-5 h-5 text-primary" />
        <h2 className="text-xl font-bold text-foreground" style={{ fontFamily: "'Fraunces', serif" }}>
          Om data & metode
        </h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        Vi tror på fuld gennemsigtighed. Alle data er offentligt tilgængelige og kan verificeres.
      </p>

      {/* Phase awareness note */}
      <div className="p-4 rounded-xl bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-800/30 mb-6">
        <div className="flex gap-2.5 items-start">
          <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-foreground mb-1">Om projektfaser og dataforbehold</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Alle projekttal opdeles efter fase: <strong>forundersøgelse</strong> (ansøgt, ikke godkendt),{' '}
              <strong>godkendt</strong> (tilsagn givet, ikke bygget) og <strong>anlagt</strong> (faktisk gennemført).
              Kun anlagte projekter har realiseret miljøeffekt. Data hentes fra 9 offentlige kilder og opdateres dagligt.
            </p>
          </div>
        </div>
      </div>

      {/* CTA to full transparency page */}
      <Link
        to="/data-og-metode"
        className="flex items-center gap-3 p-5 rounded-xl bg-primary/5 border border-primary/10 hover:bg-primary/10 transition-colors group mb-6"
      >
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 group-hover:bg-primary/20 transition-colors">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
            Se fuld dokumentation af data og metode
          </p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Datakilder, ETL-pipeline, datakvalitet, beregningsmetoder og begrænsninger — med links til kildekode og rådata.
          </p>
        </div>
      </Link>

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
