import type { MetricMode } from '@/lib/metric-mode';
import { PERMALINK_KEYS } from '../schema';

export function decodeProjectsMetric(params: URLSearchParams): MetricMode {
  const raw = params.get(PERMALINK_KEYS.projektenhed);
  if (raw === 'antal') return 'count';
  return 'area';
}

export function applyProjectsMetricToParams(
  params: URLSearchParams,
  mode: MetricMode,
): void {
  params.delete(PERMALINK_KEYS.projektenhed);
  if (mode === 'count') params.set(PERMALINK_KEYS.projektenhed, 'antal');
}
