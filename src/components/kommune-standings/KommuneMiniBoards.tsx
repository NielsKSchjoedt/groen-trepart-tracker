import { useMemo, useState } from 'react';
import { Mountain, Trees, Droplets, Leaf, Factory } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import {
  BOARDS,
  activeOptionId,
  boardLensKey,
  buildBoardEntries,
  type BoardContext,
  type BoardDef,
  type BoardEntry,
  type BoardKey,
} from '@/lib/kommune-boards';
import type { StandingsLensKey } from '@/lib/kommune-ranking';
import { InfoTooltip } from '@/components/InfoTooltip';
import { MEDAL_COLORS } from './heatmap';

interface KommuneMiniBoardsProps {
  ctx: BoardContext;
  region: string;
  selectedKode: string | null;
  onSelect: (kode: string) => void;
  /** Sort the master table by a levering-board axis (only fired by global boards). */
  onSortAxis: (key: StandingsLensKey) => void;
  activeSortKey: StandingsLensKey | 'leveretHa';
}

const BOARD_ICONS: Record<BoardKey, LucideIcon> = {
  lavbund: Mountain,
  skov: Trees,
  kvaelstof: Droplets,
  natur: Leaf,
  co2: Factory,
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
}: KommuneMiniBoardsProps) {
  const virkemidler = BOARDS.filter((b) => b.kind === 'levering');
  const effekter = BOARDS.filter((b) => b.kind === 'status');

  const board = (def: BoardDef) => (
    <MiniBoard
      key={def.key}
      def={def}
      ctx={ctx}
      region={region}
      selectedKode={selectedKode}
      onSelect={onSelect}
      onSortAxis={onSortAxis}
      isActiveSort={boardLensKey(def.key) != null && activeSortKey === boardLensKey(def.key)}
    />
  );

  return (
    <div className="space-y-5">
      <section>
        <GroupHeading label="Virkemidler" hint="Indsats kommunen selv leverer — målt ift. ansvar" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {virkemidler.map(board)}
        </div>
      </section>

      <section>
        <GroupHeading label="Effekter" hint="Aktuel tilstand i kommunen — ikke direkte Trepart-levering" />
        <div className="flex flex-col sm:flex-row flex-wrap justify-center gap-3">
          {effekter.map((def) => (
            <div key={def.key} className="w-full sm:w-[calc(50%-0.375rem)] xl:w-[calc(33.333%-0.5rem)]">
              {board(def)}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

/** Labelled divider separating the virkemidler and effekter board groups. */
function GroupHeading({ label, hint }: { label: string; hint: string }) {
  return (
    <div className="flex items-center gap-2.5 mb-2.5 px-1">
      <span
        className="text-xs font-bold uppercase tracking-wide text-foreground flex-shrink-0"
        style={{ fontFamily: "'Fraunces', serif" }}
      >
        {label}
      </span>
      <span className="text-[11px] text-muted-foreground flex-shrink min-w-0 truncate hidden sm:block">{hint}</span>
      <div className="flex-1 h-px bg-border/60" />
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
}: {
  def: BoardDef;
  ctx: BoardContext;
  region: string;
  selectedKode: string | null;
  onSelect: (kode: string) => void;
  onSortAxis: (key: StandingsLensKey) => void;
  isActiveSort: boolean;
}) {
  const [localOption, setLocalOption] = useState(def.options[0].id);
  const optionId = activeOptionId(def, ctx.globalMode, localOption);
  const option = def.options.find((o) => o.id === optionId) ?? def.options[0];
  const Icon = BOARD_ICONS[def.key];
  const lensKey = boardLensKey(def.key);

  const entries = useMemo(() => buildBoardEntries(def, optionId, ctx), [def, optionId, ctx]);
  const visible = useMemo(() => {
    const filtered = region === 'Alle regioner' ? entries : entries.filter((e) => e.region === region);
    return filtered.slice(0, PODIUM_COUNT);
  }, [entries, region]);

  const podium = visible.slice(0, 3);
  const podiumOrder = [podium[1], podium[0], podium[2]].filter(Boolean) as BoardEntry[];
  const rest = visible.slice(3, PODIUM_COUNT);

  const headerInner = (
    <>
      <span
        className="flex items-center justify-center w-8 h-8 rounded-lg flex-shrink-0"
        style={{ backgroundColor: tint(def.tone, 0.7) }}
      >
        <Icon style={{ color: def.tone, width: 18, height: 18 }} strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span
            className="text-sm font-bold leading-tight"
            style={{ color: ink(def.tone), fontFamily: "'Fraunces', serif" }}
          >
            {def.label}
          </span>
          {def.kind === 'status' && (
            <span
              className="text-[9px] font-semibold uppercase tracking-wide rounded px-1 py-px"
              style={{ color: def.tone, backgroundColor: tint(def.tone, 0.78) }}
            >
              status
            </span>
          )}
        </span>
        <span className="block text-[10px] leading-tight truncate" style={{ color: def.tone }}>
          {option.sub}
        </span>
      </span>
    </>
  );

  return (
    <div
      className={[
        'rounded-2xl border bg-card overflow-hidden flex flex-col',
        isActiveSort ? 'border-primary/50 ring-1 ring-primary/20' : 'border-border',
      ].join(' ')}
    >
      {/* Branded header — delmål colour + icon. Levering-boards sort the master table on click. */}
      {def.global && lensKey ? (
        <button
          type="button"
          onClick={() => onSortAxis(lensKey)}
          className="flex items-center gap-2.5 px-3 py-2.5 text-left transition-[filter] cursor-pointer hover:brightness-[0.97]"
          style={{ backgroundColor: tint(def.tone, 0.88) }}
          title={`Sortér den fulde liste efter ${def.full.toLowerCase()}`}
        >
          {headerInner}
        </button>
      ) : (
        <div
          className="flex items-center gap-2.5 px-3 py-2.5"
          style={{ backgroundColor: tint(def.tone, 0.88) }}
        >
          {headerInner}
        </div>
      )}

      {/* Per-board måleenhed toggle — status boards only (levering follows the global toggle) */}
      {!def.global && def.options.length > 1 && (
        <div
          className="flex items-center gap-1 px-3 py-2 border-b border-border/60"
          role="group"
          aria-label={`Måleenhed for ${def.label}`}
        >
          {def.options.map((o) => {
            const active = o.id === optionId;
            return (
              <button
                key={o.id}
                type="button"
                onClick={() => setLocalOption(o.id)}
                aria-pressed={active}
                className="flex-1 rounded-md px-2 py-1 text-[11px] font-semibold transition-colors cursor-pointer"
                style={
                  active
                    ? { backgroundColor: tint(def.tone, 0.82), color: ink(def.tone) }
                    : { color: 'var(--muted-foreground)' }
                }
              >
                {o.label}
              </button>
            );
          })}
          <InfoTooltip
            title={`${def.label} — måleenheder`}
            content={
              <>
                {def.options.map((o) => (
                  <div key={o.id} className="space-y-1">
                    <p>
                      <strong>{o.label}</strong> — {o.desc}
                    </p>
                    {o.formula.kind === 'ratio' ? (
                      <p className="text-foreground">
                        <span className="font-medium">Beregnet:</span> ({o.formula.top}) ÷ ({o.formula.bottom}) — {o.formula.result}
                      </p>
                    ) : (
                      <p className="text-foreground">
                        <span className="font-medium">Beregnet:</span> {o.formula.expr} — {o.formula.result}
                      </p>
                    )}
                  </div>
                ))}
              </>
            }
            source={def.source}
            size={13}
            side="bottom"
            align="end"
          />
        </div>
      )}

      {/* Podium — top 3 */}
      {podiumOrder.length > 0 ? (
        <div className="flex items-end justify-center gap-1.5 px-3 pt-3.5 pb-1">
          {podiumOrder.map((km) => {
            const place = podium.findIndex((p) => p.kode === km.kode) + 1; // 1/2/3 within visible podium
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
    </div>
  );
}
