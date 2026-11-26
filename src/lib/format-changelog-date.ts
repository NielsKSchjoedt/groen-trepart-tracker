/** Format an ISO date (YYYY-MM-DD) as a Danish long date, e.g. "26. november 2026". */
export function formatChangelogDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString('da-DK', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
