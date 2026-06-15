import { useMemo } from 'react';
import { Info, TrendingUp } from 'lucide-react';
import type { DashboardData } from '@/lib/types';
import type { FremskrivningPillarId, FremskrivningStageId, StageSelection } from '@/lib/fremskrivning';
import {
  assessFremskrivningStatus,
  buildFremskrivningModel,
  buildProjection,
  isStageActive,
  formatFremskrivningPct,
  formatFremskrivningValue,
  hasSupplementStages,
} from '@/lib/fremskrivning';
import { formatDanishNumber } from '@/lib/format';
import { PILLAR_CONFIGS } from '@/lib/pillars';
import { useParsedViewState, usePermalinkPatch } from '@/lib/permalink/useViewState';
import {
  fremskrivningToSelectionOverrides,
  activeStagesToFremskrivning,
} from '@/lib/permalink/slices/fremskrivning';
import { CopyLinkButton } from '@/lib/permalink/CopyLinkButton';
import { StageRow } from './StageRow';
import { StackedAreaChart } from './StackedAreaChart';
import { PaceWarning } from './PaceWarning';
import { StatusPill } from './StatusPill';

interface FremskrivningCardProps {
  data: DashboardData;
  pillar: FremskrivningPillarId;
}

export function FremskrivningCard({ data, pillar }: FremskrivningCardProps) {
  const viewState = useParsedViewState();
  const { patch } = usePermalinkPatch();

  const model = useMemo(() => buildFremskrivningModel(data, pillar), [data, pillar]);

  const optionalStageIds = useMemo(
    () =>
      model
        ? model.stages.filter((s) => s.id !== 'anlagt').map((s) => s.id as Exclude<FremskrivningStageId, 'anlagt'>)
        : [],
    [model],
  );

  const selectionOverrides: StageSelection = useMemo(
    () => fremskrivningToSelectionOverrides(viewState.fremskrivning, optionalStageIds),
    [viewState.fremskrivning, optionalStageIds],
  );

  const projection = useMemo(
    () => (model ? buildProjection(model, selectionOverrides) : null),
    [model, selectionOverrides],
  );

  if (!model || !projection) {
    return (
      <div className="rounded-xl border border-border p-4 bg-muted/30 text-sm text-muted-foreground">
        Ingen pipeline-data til fremskrivning for dette delmål.
      </div>
    );
  }

  const config = PILLAR_CONFIGS.find((p) => p.id === pillar)!;
  const status = assessFremskrivningStatus(projection.scenarioPct);
  const marsStages = model.stages.filter((s) => s.kind === 'mars');
  const supplementStages = model.stages.filter((s) => s.kind !== 'mars');
  const showSupplements = hasSupplementStages(model.stages);

  const activeStages = model.stages.filter((s) => isStageActive(s, selectionOverrides));
  const hasOptionalPipeline = activeStages.some(
    (s) => !s.locked && s.kind !== 'supplement_completed',
  );
  const onlyBuilt = !hasOptionalPipeline;
  const scenarioNames = activeStages.map((s) => s.label).join(' + ');

  const toggle = (id: Exclude<FremskrivningStageId, 'anlagt'>) => {
    const stage = model.stages.find((s) => s.id === id);
    if (!stage) return;
    const nextOverrides = { ...selectionOverrides, [id]: !isStageActive(stage, selectionOverrides) };
    const active = new Set<Exclude<FremskrivningStageId, 'anlagt'>>();
    for (const sid of optionalStageIds) {
      const s = model.stages.find((st) => st.id === sid);
      if (s && isStageActive(s, nextOverrides)) active.add(sid);
    }
    patch({ fremskrivning: activeStagesToFremskrivning(active) }, { immediate: true });
  };

  const targetIntro =
    pillar === 'nitrogen'
      ? `${formatDanishNumber(model.target)} ton`
      : `${formatDanishNumber(model.target)} ${model.unitShort}`;

  const introCopy =
    pillar === 'afforestation'
      ? 'Baseret på MARS og supplerende kilder (Klimaskovfonden, Naturstyrelsen). Gennemførte projekter tæller i dag — eksterne kilder kan slås fra, hvis du kun vil se MARS.'
      : pillar === 'extraction'
        ? 'Baseret på MARS og supplerende kilder, hvor de findes. Kun gennemførte projekter tæller med i den faktiske fremdrift i dag.'
        : 'Baseret på faktiske projektdata fra MARS. Hver projektfase rummer effekt — men kun de gennemførte tæller med i dag.';

  return (
    <div className="rounded-xl border border-border bg-card p-6 sm:p-7 shadow-sm">
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <h3
            className="flex items-center gap-2 text-xl font-semibold text-foreground m-0"
            style={{ fontFamily: "'Fraunces', serif" }}
          >
            <TrendingUp className="w-5 h-5" style={{ color: model.accentColor }} />
            Fremskrivning: {config.label}
          </h3>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl leading-relaxed">{introCopy}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
        <CopyLinkButton />
        <span
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[13px] font-bold whitespace-nowrap"
          style={{ backgroundColor: model.accentColor + '16', color: model.accentColor }}
        >
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: model.accentColor }} />
          {config.label}
        </span>
        </div>
      </div>

      {/* Step 1 */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <span
            className="flex-shrink-0 w-6 h-6 rounded-full text-white text-[13px] font-extrabold inline-flex items-center justify-center"
            style={{ backgroundColor: model.accentColor }}
          >
            1
          </span>
          <h4 className="text-base font-bold text-foreground m-0">
            Vælg, hvad du tror bliver til virkelighed
          </h4>
        </div>
        <p className="text-[13.5px] text-muted-foreground mb-3.5 ml-8 leading-relaxed">
          Projekterne modnes trin for trin — fra løs skitse til gennemført og i drift. Tænd for de
          stadier, du tror når i mål.
        </p>
        <div className="flex flex-col gap-2">
          <p className="text-[13px] font-semibold text-muted-foreground mb-0.5 ml-1">
            MARS-projekter
          </p>
          {marsStages.map((stage) => (
            <StageRow
              key={stage.id}
              stage={stage}
              active={isStageActive(stage, selectionOverrides)}
              accent={model.accentColor}
              unitShort={model.unitShort}
              showCounts
              onToggle={toggle}
            />
          ))}

          {showSupplements && (
            <>
              <p className="text-[13px] font-semibold text-muted-foreground mt-2 mb-0.5 ml-1">
                Eksterne kilder (ikke i MARS)
              </p>
              {supplementStages.map((stage) => (
                <StageRow
                  key={stage.id}
                  stage={stage}
                  active={isStageActive(stage, selectionOverrides)}
                  accent={stage.certColor}
                  unitShort={model.unitShort}
                  showCounts={stage.projectCount > 0}
                  onToggle={toggle}
                />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Step 2 */}
      <div className="mt-7">
        <div className="flex items-center gap-2.5 mb-3.5">
          <span
            className="flex-shrink-0 w-6 h-6 rounded-full text-white text-[13px] font-extrabold inline-flex items-center justify-center"
            style={{ backgroundColor: model.accentColor }}
          >
            2
          </span>
          <h4 className="text-base font-bold text-foreground m-0">
            Så langt når {pillar === 'nitrogen' ? 'kvælstof-målet' : `${config.label.toLowerCase()}-målet`}
          </h4>
        </div>

        <div
          className="rounded-lg border-2 p-5 sm:p-6 transition-colors duration-200"
          style={{
            borderColor: status.panelBorder,
            backgroundColor: status.panelBg,
          }}
        >
          <div className="flex items-center justify-between gap-3">
            <span
              className="font-black text-[42px] sm:text-[46px] leading-none tabular-nums"
              style={{ fontFamily: "'Fraunces', serif", color: status.color }}
            >
              {formatFremskrivningValue(projection.scenarioTon)}
              <span className="text-xl font-bold"> {model.unitShort}</span>
            </span>
            <StatusPill status={status} size="lg" />
          </div>
          <p className="text-[15px] text-foreground leading-relaxed mt-2.5">
            {onlyBuilt ? (
              <>
                Det er <b>{formatFremskrivningPct(projection.scenarioPct)}%</b> af målet. Alt andet
                i pipelinen er endnu ikke realiseret.
              </>
            ) : (
              <>
                Hvis <b>{scenarioNames}</b> alle realiseres, dækker det{' '}
                <b style={{ color: status.color }}>
                  {formatFremskrivningPct(projection.scenarioPct)}%
                </b>{' '}
                af målet på {targetIntro}.
              </>
            )}
          </p>

          <div className="mt-5">
            <StackedAreaChart model={model} projection={projection} accent={model.accentColor} />
          </div>
        </div>

        <PaceWarning
          pace={projection.pace}
          unitShort={model.unitShort}
          deadlineYear={model.deadlineYear}
        />

        <p className="flex gap-2 items-start mt-3.5 text-xs italic text-amber-700 leading-relaxed">
          <Info className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            Jo lysere et lag er, jo mere usikkert er det. Skitser fylder mest — men er længst fra
            at blive til virkelig {pillar === 'nitrogen' ? 'kvælstof-reduktion' : 'effekt'}.
          </span>
        </p>
      </div>
    </div>
  );
}
