import type { FremskrivningStatusKey, FremskrivningStatusMeta } from './types';

export const FREMSKRIVNING_STATUS_META: Record<FremskrivningStatusKey, FremskrivningStatusMeta> = {
  reached: {
    key: 'reached',
    label: 'Mål i sigte',
    color: '#16a34a',
    icon: '✓',
    pillBg: '#dcfce7',
    pillBorder: '#16a34a',
    panelBg: '#f0fdf4',
    panelBorder: '#86efac',
  },
  ontrack: {
    key: 'ontrack',
    label: 'Når målet',
    color: '#15803d',
    icon: '✓',
    pillBg: '#dcfce7',
    pillBorder: '#22c55e',
    panelBg: '#f0fdf4',
    panelBorder: '#86efac',
  },
  veryclose: {
    key: 'veryclose',
    label: 'Tæt på målet',
    color: '#4d7c0f',
    icon: '○',
    pillBg: '#ecfccb',
    pillBorder: '#65a30d',
    panelBg: '#f7fee7',
    panelBorder: '#bef264',
  },
  close: {
    key: 'close',
    label: 'Delvis dækning',
    color: '#a16207',
    icon: '○',
    pillBg: '#fef3c7',
    pillBorder: '#ca8a04',
    panelBg: '#fffbeb',
    panelBorder: '#fcd34d',
  },
  behind: {
    key: 'behind',
    label: 'Langt fra målet',
    color: '#b91c1c',
    icon: '!',
    pillBg: '#fee2e2',
    pillBorder: '#dc2626',
    panelBg: '#fef2f2',
    panelBorder: '#fca5a5',
  },
};

/**
 * Goal-status for the fremskrivning scenario panel.
 * Stricter thresholds so labels match plain-language expectations.
 */
export function assessFremskrivningStatus(pct: number): FremskrivningStatusMeta {
  if (pct >= 100) return FREMSKRIVNING_STATUS_META.reached;
  if (pct >= 95) return FREMSKRIVNING_STATUS_META.ontrack;
  if (pct >= 80) return FREMSKRIVNING_STATUS_META.veryclose;
  if (pct >= 50) return FREMSKRIVNING_STATUS_META.close;
  return FREMSKRIVNING_STATUS_META.behind;
}
