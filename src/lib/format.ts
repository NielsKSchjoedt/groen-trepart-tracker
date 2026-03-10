/** Format a number with Danish locale (dot as thousand separator, comma as decimal) */
export function formatDanishNumber(value: number, decimals = 0): string {
  return value.toLocaleString('da-DK', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Calculate days remaining until a date */
export function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

/** Get progress color class based on percentage */
export function getProgressColor(pct: number): string {
  if (pct >= 80) return '#16a34a'; // green-600
  if (pct >= 60) return '#84cc16'; // lime-500
  if (pct >= 40) return '#facc15'; // yellow-400
  if (pct >= 20) return '#f97316'; // orange-500
  return '#dc2626'; // red-600
}

export function getProgressColorClass(pct: number): string {
  if (pct >= 80) return 'text-green-600';
  if (pct >= 60) return 'text-lime-500';
  if (pct >= 40) return 'text-yellow-500';
  if (pct >= 20) return 'text-orange-500';
  return 'text-red-600';
}
