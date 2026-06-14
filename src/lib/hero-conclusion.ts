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

/** Short mid-sentence names for the three virkemidler. */
const MEASURE_SHORT: Record<string, string> = {
  skov: 'skovrejsning',
  lavbund: 'lavbund',
  vaadomraade: 'kvælstof',
};

function capitalise(s: string): string {
  return s.length > 0 ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * Plain-words status for the three virkemidler, e.g.
 * "Alle tre virkemidler er langt bagud." or
 * "Skovrejsning er langt bagud, lavbund er kritisk bagud og kvælstof er på sporet."
 */
function virkemiddelStatusSentence(measures: Measure[]): string {
  if (measures.length === 0) return '';
  const verdicts = measures.map((m) => ({
    label: MEASURE_SHORT[m.id] ?? m.label.toLowerCase(),
    verdict: paceVerdictLabel(m.status, m.timeElapsedPct).toLowerCase(),
  }));
  const allSame = verdicts.every((v) => v.verdict === verdicts[0].verdict);
  if (allSame) return `Alle tre virkemidler er ${verdicts[0].verdict}.`;
  const parts = verdicts.map((v) => `${v.label} er ${v.verdict}`);
  const joined =
    parts.length > 1
      ? `${parts.slice(0, -1).join(', ')} og ${parts[parts.length - 1]}`
      : parts[0];
  return `${capitalise(joined)}.`;
}

export interface HeroConclusion {
  /** Bold one-line verdict, e.g. "Vi er ikke på sporet." */
  verdict: string;
  /** Progress sentence for the three virkemidler. */
  buildLine: string;
  /** Effects sentence — klima, natur, vandmiljø, never summed. */
  effectLine: string;
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

  const virkemiddelLine = virkemiddelStatusSentence(measures);

  const buildLine =
    `Samlet ${built} af de ${composite.totalMeasures} virkemidler er til dato anlagt. ` +
    `Ved nuværende tempo lander vi på ~${projected} af målet. ${deadlineLine}` +
    (virkemiddelLine ? ` ${virkemiddelLine}` : '');

  const klima = effectDomains.find((d) => d.id === 'klima');
  const natur = effectDomains.find((d) => d.id === 'natur');
  const vand = effectDomains.find((d) => d.id === 'vand');
  const vandYear = getPillarConfig('nitrogen').deadlineYear;

  // Each effect is its own short sentence — they carry internal commas, so
  // stringing them together with commas would read as one run-on clause.
  const sentences: string[] = [];
  if (klima) {
    const nearTarget = NEAR_OR_BETTER.includes(klima.status);
    sentences.push(
      `Klimaet er ${nearTarget ? 'nationalt nær målet' : 'bagud nationalt'}, men båret mest af energisektoren.`,
    );
  }
  if (natur) {
    const verdict =
      natur.reframe.kind === 'baseline-gap'
        ? natur.reframe.verdictLabel.toLowerCase()
        : 'afventer data';
    sentences.push(`Den beskyttede natur ${verdict}.`);
  }
  if (vand) {
    if (vand.reframe.kind === 'ecological-snapshot' && vand.reframe.totalWaters > 0) {
      sentences.push(
        `Kystvandenes økologiske tilstand er langt fra god — kun ${vand.reframe.goodCount} af ${vand.reframe.totalWaters} vurderes god (VP3).`,
      );
    } else {
      sentences.push(`Vandmiljøet er ${vandFragment(vand.status, vandYear)}.`);
    }
  }

  const effectLine = sentences.length > 0 ? sentences.join(' ') : 'Effekterne indlæses…';

  return { verdict: verdictFor(composite.status), buildLine, effectLine, color: meta.color };
}
