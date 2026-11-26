/**
 * Dynamic "Kort sagt" hero conclusion.
 *
 * Generates the headline verdict + supporting sentence purely from the live
 * model values (IndsatsComposite + EffectDomain[]), so the conclusion updates
 * itself when new data is fetched — no manual copy edits required.
 *
 * Honesty principle (see lib/model.ts): the three virkemidler share ONE
 * progress number; the effects are never summed — each gets its own honest
 * verdict word derived from its status/reframe.
 */
import { formatPctHeadline, type EffectDomain, type IndsatsComposite, type Measure } from './model';
import { GOAL_STATUS_META, paceVerdictLabel, type GoalStatus } from './projections';
import { getPillarConfig } from './pillars';

function capitalise(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

/** One row in the "Kort sagt" box: a virkemiddel or an effekt with its own status. */
export interface ConclusionStatusItem {
  id: string;
  label: string;
  /** Short status text, e.g. "Langt bagud" or "Nationalt nær målet, men …". */
  text: string;
  /** Status colour from GOAL_STATUS_META. */
  color: string;
}

/** Per-virkemiddel status rows, e.g. Skovrejsning → "Langt bagud". */
function measureStatusItems(measures: Measure[]): ConclusionStatusItem[] {
  return measures.map((m) => ({
    id: m.id,
    label: m.label,
    text: paceVerdictLabel(m.status, m.timeElapsedPct),
    color: GOAL_STATUS_META[m.status].color,
  }));
}

export interface HeroConclusion {
  /** Bold one-line verdict, e.g. "Vi er ikke på sporet." */
  verdict: string;
  /** Lead copy — overall progress, pace and how many delmål are reached in time. */
  summary: string[];
  /** One status row per virkemiddel (indsats). */
  measureItems: ConclusionStatusItem[];
  /** One status row per effekt — klima, natur, vandmiljø, never summed. */
  effectItems: ConclusionStatusItem[];
  /** Status colour (matches the gauge verdict colour). */
  color: string;
}

const NEAR_OR_BETTER: GoalStatus[] = ['reached', 'on-track', 'very-close', 'close'];

function verdictFor(status: GoalStatus): string {
  switch (status) {
    case 'reached':
    case 'on-track':
      return 'Vi er på sporet.';
    case 'very-close':
    case 'close':
      return 'Vi er tæt på — men ikke i mål endnu.';
    case 'unknown':
      return 'Det er endnu for tidligt at konkludere.';
    case 'behind':
    default:
      return 'Vi er ikke på sporet.';
  }
}

function vandFragment(status: GoalStatus, year: number): string {
  switch (status) {
    case 'reached':
    case 'on-track':
      return 'på vej mod målet';
    case 'very-close':
    case 'close':
      return `tæt på fristen i ${year}`;
    case 'unknown':
      return 'afventer data';
    case 'behind':
    default:
      return `bagud før fristen i ${year}`;
  }
}

const ON_TRACK: GoalStatus[] = ['on-track', 'reached'];

function countOnTrackEffects(effectDomains: EffectDomain[]): {
  onTrack: number;
  total: number;
} {
  const delmaal = effectDomains.filter((d) => d.isDelmaal !== false);
  return {
    onTrack: delmaal.filter((d) => ON_TRACK.includes(d.status)).length,
    total: delmaal.length,
  };
}

/**
 * Build the dynamic conclusion. `effectDomains` may be empty/partial while CO₂
 * data is still loading — the effect line degrades gracefully.
 */
export function buildHeroConclusion(
  composite: IndsatsComposite,
  effectDomains: EffectDomain[],
  measures: Measure[] = [],
): HeroConclusion {
  const meta = GOAL_STATUS_META[composite.status];
  const built = formatPctHeadline(composite.builtPct);
  const projected = formatPctHeadline(composite.projectedPct);
  const { onTrack: effectOnTrack, total: effectTotal } = countOnTrackEffects(effectDomains);

  const deadlineLine =
    effectTotal > 0
      ? `Til delmålenes frister nås ${composite.onTrackCount} af ${composite.totalMeasures} virkemidler og ${effectOnTrack} af ${effectTotal} effekter.`
      : `Til delmålenes frister nås ${composite.onTrackCount} af ${composite.totalMeasures} virkemidler.`;

  const summary = [
    `Samlet ${built} af de ${composite.totalMeasures} virkemidler er til dato anlagt. Ved nuværende tempo lander vi på ~${projected} af målet.`,
    deadlineLine,
  ];

  const klima = effectDomains.find((d) => d.id === 'klima');
  const natur = effectDomains.find((d) => d.id === 'natur');
  const vand = effectDomains.find((d) => d.id === 'vand');
  const vandYear = getPillarConfig('nitrogen').deadlineYear;

  const effectItem = (d: EffectDomain, text: string): ConclusionStatusItem => ({
    id: d.id,
    label: d.label,
    text,
    color: GOAL_STATUS_META[d.status].color,
  });

  const effectItems: ConclusionStatusItem[] = [];
  if (klima) {
    const nearTarget = NEAR_OR_BETTER.includes(klima.status);
    effectItems.push(
      effectItem(
        klima,
        `${nearTarget ? 'Nationalt nær målet' : 'Bagud nationalt'}, men båret mest af energisektoren.`,
      ),
    );
  }
  if (natur) {
    if (natur.status === 'unknown') {
      effectItems.push(
        effectItem(natur, 'Om der er kommet mere beskyttet natur siden aftalen, kan endnu ikke måles.'),
      );
    } else {
      const verdict =
        natur.reframe.kind === 'baseline-gap' ? natur.reframe.verdictLabel : 'Afventer data';
      effectItems.push(effectItem(natur, `${capitalise(verdict)}.`));
    }
  }
  if (vand) {
    effectItems.push(
      effectItem(
        vand,
        vand.reframe.kind === 'ecological-snapshot'
          ? 'Kystvandenes økologiske tilstand er langt fra god.'
          : `${capitalise(vandFragment(vand.status, vandYear))}.`,
      ),
    );
  }

  return {
    verdict: verdictFor(composite.status),
    summary,
    measureItems: measureStatusItems(measures),
    effectItems,
    color: meta.color,
  };
}
