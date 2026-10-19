/**
 * Nature-pillar project selection and overlap thresholds.
 *
 * DN asked that “nature projects” be lavbund + urørt skov. MARS cannot
 * separate plantation from urørt skov nationally (only 9 SGAV projects
 * register `uroert_skov` geometry). We therefore include all afforestation
 * and show lavbund and documented urørt as separate deltas.
 */

export const NATURE_PIPELINE_MEASURES = ['Lavbundsprojekter', 'Skovrejsning'] as const;

export const NATURE_EXCLUDED_MEASURES = [
  'Kvælstofvådområder',
  'Minivådområder',
  'Ekstensivering',
  'Fosforvådområder og ådale',
  'Øvrige',
  'Forundersøgelse VLP',
] as const;

/** Overlap below this is treated as a boundary nick, not “has overlap”. */
export const NATURE_OVERLAP_THRESHOLD_HA = 0.1;

/** MARS supplementaryGeometryTypes.type for documented urørt skov (SGAV Skovrejsning only). */
export const UROERT_SKOV_TYPE = 'uroert_skov';

export const UROERT_SKOV_TYPE_ID = '434633e0-4241-4f38-b451-f2b45b70ebd4';

const NATURE_PIPELINE_SET = new Set<string>(NATURE_PIPELINE_MEASURES);

export function isNaturePipelineMeasure(measureName: string | undefined | null): boolean {
  return NATURE_PIPELINE_SET.has(measureName ?? '');
}

export function isNaturePipelineProject(project: { measureName?: string | null }): boolean {
  return isNaturePipelineMeasure(project.measureName);
}

/** First occurrence of each id wins (national funnel / lists). Empty ids are kept. */
export function uniqueByProjectId<T extends { id?: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    const id = item.id ?? '';
    if (id) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    out.push(item);
  }
  return out;
}
