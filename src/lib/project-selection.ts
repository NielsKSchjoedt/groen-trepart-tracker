import type { KlimaskovfondenProject, NaturstyrelsenSkovProject } from './types';

/**
 * Unified selection type for circle marker clicks.
 * Wraps either a Klimaskovfonden or Naturstyrelsen project with
 * the source label so the panel can render both uniformly.
 */
export type SelectedProject =
  | { source: 'klimaskovfonden'; project: KlimaskovfondenProject }
  | { source: 'naturstyrelsen'; project: NaturstyrelsenSkovProject };

/**
 * Stable identifier for a SelectedProject, used as a URL param value.
 *
 * @param sp - Selected project
 * @returns URL-safe string like "ksf:2024-346" or "nst:Drastrup Skov"
 * @example getProjectKey({ source: 'klimaskovfonden', project: p }) // "ksf:2024-346"
 */
export function getProjectKey(sp: SelectedProject): string {
  return sp.source === 'klimaskovfonden'
    ? `ksf:${sp.project.sagsnummer}`
    : `nst:${sp.project.name}`;
}
