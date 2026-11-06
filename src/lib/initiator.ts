import type { InitiatorType } from './types';

/**
 * Classify a MARS project into one of three initiator categories from
 * subsidy scheme org + name. Mirrors `etl/build_dashboard_data.classify_initiator`.
 */
export function classifyInitiator(schemeOrg: string, schemeName: string): InitiatorType {
  if (schemeOrg === 'NST') return 'state';
  if (schemeOrg === 'LBST' || schemeName === 'Minivådområder') return 'private';
  return 'municipal';
}
