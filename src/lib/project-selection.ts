import type { KlimaskovfondenProject, NaturstyrelsenSkovProject, ProjectDetail, SketchProject } from './types';

/**
 * Unified selection type for circle marker clicks.
 * Wraps either a Klimaskovfonden or Naturstyrelsen project with
 * the source label so the panel can render both uniformly.
 */
export type SelectedProject =
  | { source: 'klimaskovfonden'; project: KlimaskovfondenProject }
  | { source: 'naturstyrelsen'; project: NaturstyrelsenSkovProject }
  | { source: 'mars'; project: ProjectDetail | SketchProject; planName: string };

/**
 * Stable identifier for a SelectedProject, used as a URL param value.
 *
 * @param sp - Selected project
 * @returns URL-safe string like "ksf:2024-346", "nst:Drastrup Skov", or "mars:<geoId>"
 * @example getProjectKey({ source: 'klimaskovfonden', project: p }) // "ksf:2024-346"
 */
export function getProjectKey(sp: SelectedProject): string {
  if (sp.source === 'klimaskovfonden') return `ksf:${sp.project.sagsnummer}`;
  if (sp.source === 'naturstyrelsen') return `nst:${sp.project.name}`;
  return `mars:${sp.project.geoId}`;
}
