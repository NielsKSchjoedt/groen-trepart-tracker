/**
 * Changelog types and data.
 *
 * SINGLE SOURCE OF TRUTH: All changelog entries live in changelog.json.
 * Do NOT add entries here — edit changelog.json instead.
 *
 * After editing changelog.json, run:
 *   npm run changelog
 * to regenerate CHANGELOG.md automatically.
 *
 * WRITING STANDARD: Write for a journalist or curious citizen, not a developer.
 * Plain Danish first. Technical references go in parentheses at the end.
 * Ask: would someone with no technical background understand what changed and why?
 *
 * For corrections (type "fix" or "method"), the description MUST state:
 *   1. What users saw that was wrong — in plain terms
 *   2. What has been corrected
 *   3. A GitHub issue URL if one was filed (issueUrl field)
 */

import rawData from './changelog.json';

export type ChangeType =
  | 'feature'      // Ny funktion
  | 'improvement'  // Forbedring
  | 'fix'          // Fejlrettelse
  | 'data'         // Dataopdatering
  | 'method'       // Metodeændring
  | 'removed';     // Fjernet

export const CHANGE_TYPE_LABELS: Record<ChangeType, string> = {
  feature:     'Ny funktion',
  improvement: 'Forbedring',
  fix:         'Fejlrettelse',
  data:        'Dataopdatering',
  method:      'Metodeændring',
  removed:     'Fjernet',
};

export interface ChangelogChange {
  type: ChangeType;
  description: string;
  issueUrl?: string;
}

export interface ChangelogEntry {
  version: string;
  date: string;
  summary: string;
  changes: ChangelogChange[];
}

export const changelog = rawData as ChangelogEntry[];

/** Latest site release (synced from changelog.json via `npm run changelog`). */
export const CURRENT_VERSION = changelog[0]?.version ?? 'v?';

/** In-app link to the public release notes section. */
export const CHANGELOG_PATH = '/data-og-metode#aendringslog';

export function formatChangelogDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('da-DK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
