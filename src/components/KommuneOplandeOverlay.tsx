import { Link } from 'react-router-dom';
import { Droplets, ExternalLink } from 'lucide-react';
import type { KommuneOplandeData, KommuneOplandeEntry } from '@/lib/types';
import { getWfdStatusColor, getWfdStatusLabel, formatDanishNumber } from '@/lib/format';
import { InfoTooltip } from '@/components/InfoTooltip';

interface KommuneOplandeOverlayProps {
  kommuneKode: string;
  data: KommuneOplandeData | null;
  /** When set, show link to national nitrogen map */
  showNationalLink?: boolean;
}

/**
 * Lists coastal water groups and main catchments overlapping a municipality.
 */
export function KommuneOplandeOverlay({
  kommuneKode,
  data,
  showNationalLink = true,
}: KommuneOplandeOverlayProps) {
  if (!data) return null;
  const entry: KommuneOplandeEntry | undefined = data.byKommune[kommuneKode];
  if (!entry) return null;

  const hasCoastal = entry.kystvandsoplande.length > 0;

  return (
    <section className="rounded-2xl border border-border bg-card p-4 sm:p-5 shadow-sm">
      <div className="flex items-start gap-2 mb-3">
        <Droplets className="w-5 h-5 text-teal-600 flex-shrink-0 mt-0.5" />
        <div>
          <h3
            className="text-sm font-bold text-foreground"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            Kommunen på tværs af vandoplande
          </h3>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            {entry.kommuneNavn} ligger i{' '}
            <strong>{entry.antalOplande}</strong>{' '}
            kystvandsopland{entry.antalOplande === 1 ? '' : 'e'}. Kvælstofmålet er sat på oplandet — ikke på kommunen.
          </p>
        </div>
        <InfoTooltip
          title="Oplandsforankring"
          content={
            <>
              <p>Kvælstofindsatsbehovet fordeles på 108 kystvanddelvandoplande (VP3-II).</p>
              <p>Naturmålet er <strong>ikke</strong> geografisk fordelt på kommuner — se den faglige fordelings-simulering på{' '}
                <Link to="/kommuner?metric=natur" className="underline underline-offset-2 hover:text-foreground">
                  kommunevisningen
                </Link>.
              </p>
            </>
          }
          size={13}
        />
      </div>

      {!hasCoastal ? (
        <p className="text-sm text-muted-foreground italic">
          Ingen kystvandsoplande overlapper denne kommune (fx ø-kommuner med kun havareal).
        </p>
      ) : (
        <ul className="space-y-2.5">
          {entry.kystvandsoplande.map((op) => {
            const eco = op.ecologicalStatus ?? 'Ukendt';
            const color = getWfdStatusColor(eco);
            return (
              <li
                key={`${op.opId}-${op.opNavn}`}
                className="flex flex-wrap items-center gap-2 text-sm border-b border-border/50 pb-2 last:border-0 last:pb-0"
              >
                <span className="font-medium text-foreground flex-1 min-w-[140px]">{op.opNavn}</span>
                <span
                  className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold border"
                  style={{ borderColor: `${color}55`, color, backgroundColor: `${color}14` }}
                >
                  {getWfdStatusLabel(eco)}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums ml-auto">
                  {formatDanishNumber(op.andelAfKommunePct, 1)}% af kommunen
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {entry.hovedoplande.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground mb-2">
            Lokale treparter (hovedoplande)
          </p>
          <ul className="space-y-1.5 text-xs text-muted-foreground">
            {entry.hovedoplande.slice(0, 4).map((h) => (
              <li key={h.hovId} className="flex justify-between gap-2">
                <span className="text-foreground/90">{h.hovNavn}</span>
                <span className="tabular-nums flex-shrink-0">{formatDanishNumber(h.andelAfKommunePct, 1)}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {showNationalLink && (
        <Link
          to="/kvælstof#geografi"
          className="inline-flex items-center gap-1.5 mt-4 text-xs font-semibold text-primary hover:text-primary/80"
        >
          Se kvælstofmål på oplande i national visning
          <ExternalLink className="w-3 h-3" />
        </Link>
      )}
    </section>
  );
}
