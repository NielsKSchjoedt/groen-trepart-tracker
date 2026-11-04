import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mountain, Trees, Droplets } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  BOARDS,
  boardLensKey,
  buildBoardEntries,
  unrankedCount,
  type BoardContext,
  type BoardDef,
  type BoardEntry,
  type BoardKey,
} from '@/lib/kommune-boards';
import { MIN_ANSVAR_PCT, type StandingsLensKey } from '@/lib/kommune-ranking';
import { formatDanishNumber } from '@/lib/format';
import { BoardExplainerPanel } from '@/components/kommune-standings/BoardExplainerPanel';
import { MEDAL_COLORS } from './heatmap';

interface KommuneMiniBoardsProps {
  ctx: BoardContext;
  region: string;
  selectedKode: string | null;
  onSelect: (kode: string) => void;
  /** Sort the master table by a board's axis. */
  onSortAxis: (key: StandingsLensKey) => void;
  activeSortKey: StandingsLensKey | 'leveretHa';
  /** No official kommune split exists — shown on every board's explainer back. */
  disclaimer?: string;
}

const BOARD_ICONS: Record<BoardKey, LucideIcon> = {
  lavbund: Mountain,
  skov: Trees,
  kvaelstof: Droplets,
};

const PODIUM_COUNT = 10;
const PODIUM_HEIGHT = [66, 46, 32] as const;

/** Tint a hex tone toward white (whiteShare 0–1 = share of white mixed in). */
function tint(hex: string, whiteShare: number): string {
  return `color-mix(in srgb, ${hex} ${Math.round((1 - whiteShare) * 100)}%, white)`;
}
const ink = (hex: string) => `color-mix(in srgb, ${hex} 76%, black)`;

export function KommuneMiniBoards({
  ctx,
  region,
  selectedKode,
  onSelect,
  onSortAxis,
  activeSortKey,
  disclaimer,
}: KommuneMiniBoardsProps) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
        {BOARDS.map((def) => (
          <MiniBoard
            key={def.key}
            def={def}
            ctx={ctx}
            region={region}
            selectedKode={selectedKode}
            onSelect={onSelect}
            onSortAxis={onSortAxis}
            isActiveSort={activeSortKey === boardLensKey(def.key)}
            disclaimer={disclaimer}
          />
        ))}
      </div>
      <p className="px-1 text-[11px] text-muted-foreground leading-relaxed">
        Beskyttet natur og CO₂ rangeres ikke: de viser en tilstand i kommunen, ikke Trepart-indsats, og afhænger
        mest af geografi og energiforsyning. Se dem på{' '}
        <Link to="#geografi" className="underline underline-offset-2 hover:text-foreground">
          kortet
        </Link>{' '}
        og på den enkelte kommunes side.
      </p>
    </div>
  );
}

function MiniBoard({
  def,
  ctx,
  region,
  selectedKode,
  onSelect,
  onSortAxis,
  isActiveSort,
  disclaimer,
}: {
  def: BoardDef;
  ctx: BoardContext;
  region: string;
  selectedKode: string | null;
  onSelect: (kode: string) => void;
  onSortAxis: (key: StandingsLensKey) => void;
  isActiveSort: boolean;
  disclaimer?: string;
}) {
  const [flipped, setFlipped] = useState(false);
  const option = def.options.find((o) => o.id === ctx.globalMode) ?? def.options[0];
  const Icon = BOARD_ICONS[def.key];
  const lensKey = boardLensKey(def.key);

  const entries = useMemo(() => buildBoardEntries(def, ctx.globalMode, ctx), [def, ctx]);
  const unranked = useMemo(() => unrankedCount(def, ctx), [def, ctx]);
  const visible = useMemo(() => {
    const filtered = region === 'Alle regioner' ? entries : entries.filter((e) => e.region === region);
    return filtered.slice(0, PODIUM_COUNT);
  }, [entries, region]);

  const podium = visible.slice(0, 3);
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean) as BoardEntry[];
  const rest = visible.slice(3, PODIUM_COUNT);

  const cardBorder = isActiveSort ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border';

  const rankingFace = (
    <div className="flex flex-col [backface-visibility:hidden]" aria-hidden={flipped}>
      {/* Branded header — delmål colour + icon. The title sorts the master table;
          the explainer button sits beside it (buttons must not nest). */}
      <div
        className="flex items-center gap-2.5 px-3 py-2.5 transition-[filter] hover:brightness-[0.97]"
        style={{ backgroundColor: tint(def.tone, 0.88) }}
      >
        <button
          type="button"
          onClick={() => onSortAxis(lensKey)}
          className="flex flex-1 min-w-0 items-center gap-2.5 text-left cursor-pointer"
          title={`Sortér den fulde liste efter ${def.full.toLowerCase()}`}
        >
          <span
            className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
            style={{ backgroundColor: tint(def.tone, 0.7) }}
          >
            <Icon style={{ color: def.tone, width: 18, height: 18 }} strokeWidth={2.2} />
          </span>
          <span className="min-w-0 flex-1">
            <span
              className="block text-sm font-bold leading-tight"
              style={{ color: ink(def.tone), fontFamily: "'Fraunces', serif" }}
            >
              {def.label}
            </span>
            <span className="block text-[10px] leading-tight truncate" style={{ color: def.tone }}>
              {option.sub}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => setFlipped(true)}
          className="rounded-md border border-border/50 bg-background/70 px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-background transition-colors cursor-pointer flex-shrink-0 leading-tight"
          aria-label={`Hvordan virker ${def.label.toLowerCase()}-ranglisten?`}
        >
          Hvordan virker det?
        </button>
      </div>

      {/* Podium — top 3 */}
      {podiumOrder.length > 0 ? (
        <div className="flex items-end justify-center gap-1.5 px-3 pt-3.5 pb-1">
          {podiumOrder.map((km) => {
            const place = podium.findIndex((p) => p.kode === km.kode) + 1;
            const heightIdx = Math.min(place - 1, 2);
            const selected = km.kode === selectedKode;
            const medal = MEDAL_COLORS[Math.min(place - 1, 2)];
            const isFirst = place === 1;
            return (
              <button
                key={km.kode}
                type="button"
                onClick={() => onSelect(km.kode)}
                className={[
                  'flex flex-col items-center text-center rounded-md transition-colors cursor-pointer pt-0.5',
                  isFirst ? 'w-[36%]' : 'w-[30%]',
                  selected ? 'bg-primary/10' : 'hover:bg-muted/40',
                ].join(' ')}
                title={`${km.navn} — ${km.phrase}`}
              >
                <span className="text-[11px] font-medium text-foreground leading-tight line-clamp-2 px-0.5">
                  {km.navn}
                </span>
                <span className="text-[10px] font-semibold mt-0.5" style={{ color: def.tone }}>
                  {km.phrase}
                </span>
                <span
                  className="w-full rounded-t-md flex items-start justify-center mt-1 font-bold tabular-nums"
                  style={{
                    height: PODIUM_HEIGHT[heightIdx],
                    backgroundColor: tint(def.tone, isFirst ? 0 : place === 2 ? 0.35 : 0.55),
                    color: isFirst ? 'white' : ink(def.tone),
                    fontSize: isFirst ? 15 : 13,
                    paddingTop: 3,
                    boxShadow: `inset 0 3px 0 ${medal}`,
                  }}
                >
                  {km.rank}
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <p className="px-3 py-6 text-center text-xs text-muted-foreground">Ingen data for denne region.</p>
      )}

      {/* Ranks 4–10 */}
      {rest.length > 0 && (
        <ul className="flex-1 divide-y divide-border/60 border-t border-border/60">
          {rest.map((km) => {
            const selected = km.kode === selectedKode;
            return (
              <li key={km.kode}>
                <button
                  type="button"
                  onClick={() => onSelect(km.kode)}
                  className={[
                    'w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs transition-colors cursor-pointer',
                    selected ? 'bg-primary/10' : 'hover:bg-muted/40',
                  ].join(' ')}
                >
                  <span className="w-5 text-center font-bold tabular-nums flex-shrink-0 text-muted-foreground">
                    {km.rank}
                  </span>
                  <span className="flex-1 truncate font-medium text-foreground">{km.navn}</span>
                  <span className="text-[11px] font-semibold flex-shrink-0 text-right" style={{ color: def.tone }}>
                    {km.phrase}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {unranked > 0 && (
        <p className="px-3 py-1.5 border-t border-border/60 text-[10px] text-muted-foreground">
          {unranked} kommuner rangeres ikke: under {formatDanishNumber(MIN_ANSVAR_PCT, 1)} % af målet eller intet krav.
        </p>
      )}
    </div>
  );

  return (
    <div
      className={['rounded-2xl border bg-card overflow-hidden [perspective:1000px]', cardBorder].join(' ')}
    >
      <div
        className={[
          'relative w-full transition-transform duration-500 ease-in-out motion-reduce:transition-none',
          flipped ? '[transform:rotateY(180deg)]' : '[transform:rotateY(0deg)]',
        ].join(' ')}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {rankingFace}
        <div
          className="absolute inset-0 flex flex-col min-h-full [backface-visibility:hidden] [transform:rotateY(180deg)]"
          aria-hidden={!flipped}
        >
          <BoardExplainerPanel
            def={def}
            disclaimer={disclaimer}
            onClose={() => setFlipped(false)}
          />
        </div>
      </div>
    </div>
  );
}
