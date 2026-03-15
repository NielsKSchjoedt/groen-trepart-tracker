/**
 * Canonical phase definitions for MARS project implementation stages.
 *
 * This is the **single source of truth** for phase labels, colours, and icons
 * across the entire application. Every component that displays phase badges,
 * dots, stacked bars, or filter pills must import from here.
 *
 * Phase order (earliest → latest):
 *   sketch       → Skitse (rough outline, not yet in formal study)
 *   preliminary  → Forundersøgelse (feasibility study granted, not yet approved)
 *   approved     → Godkendt / Etableringstilsagn (approved for construction)
 *   established  → Anlagt (physically built and operational)
 *
 * Note: the MARS data model uses "assessed" in ProjectCounts as a synonym for
 * "preliminary". Use STAGE_TO_PHASE to map legacy keys to canonical phase ids.
 */
import { Pencil, ClipboardCheck, ShieldCheck, Hammer } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type ProjectPhase = 'sketch' | 'preliminary' | 'approved' | 'established';

export interface PhaseConfig {
  id: ProjectPhase;
  /** Danish singular label (e.g. "Skitse") */
  label: string;
  /** Danish plural label (e.g. "Skitser") */
  labelPlural: string;
  /** Short explanatory description */
  description: string;
  /** Primary hex colour for this phase */
  hex: string;
  /** Light hex variant for backgrounds / chart fills */
  hexLight: string;
  /** Tailwind classes for active pill / badge style */
  pillActive: string;
  /** Tailwind class for the colour dot */
  dot: string;
  /** Tailwind text colour class */
  text: string;
  /** Tailwind classes for compact badge (bg + text) */
  badge: string;
  /** Lucide icon component representing this phase */
  icon: LucideIcon;
}

/**
 * Ordered list of all phase configs from earliest to latest.
 *
 * Colour rationale:
 *   sketch       → slate  (neutral / uncertain)
 *   preliminary  → amber  (investigation / caution)
 *   approved     → blue   (official / confirmed)
 *   established  → emerald (complete / success)
 */
export const PHASE_CONFIGS: PhaseConfig[] = [
  {
    id: 'sketch',
    label: 'Skitse',
    labelPlural: 'Skitser',
    description: 'Skitseprojekter — tidligste fase, kun et groft overblik over mulige projekter',
    hex: '#94a3b8',
    hexLight: '#f1f5f9',
    pillActive: 'bg-slate-100 border-slate-300 text-slate-700',
    dot: 'bg-slate-400',
    text: 'text-slate-600 dark:text-slate-400',
    badge: 'bg-slate-100 text-slate-600',
    icon: Pencil,
  },
  {
    id: 'preliminary',
    label: 'Forundersøgelse',
    labelPlural: 'Forundersøgelser',
    description: 'Projekter med tilsagn om forundersøgelse — mulig implementering, ikke godkendt endnu',
    hex: '#f59e0b',
    hexLight: '#fffbeb',
    pillActive: 'bg-amber-50 border-amber-300 text-amber-800',
    dot: 'bg-amber-500',
    text: 'text-amber-700 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-700',
    icon: ClipboardCheck,
  },
  {
    id: 'approved',
    label: 'Godkendt',
    labelPlural: 'Godkendte',
    description: 'Projekter med etableringstilsagn — godkendt til anlæg, ikke bygget endnu',
    hex: '#3b82f6',
    hexLight: '#eff6ff',
    pillActive: 'bg-blue-50 border-blue-300 text-blue-800',
    dot: 'bg-blue-500',
    text: 'text-blue-700 dark:text-blue-400',
    badge: 'bg-blue-100 text-blue-700',
    icon: ShieldCheck,
  },
  {
    id: 'established',
    label: 'Anlagt',
    labelPlural: 'Anlagte',
    description: 'Projekter der er fysisk anlagt og i drift',
    hex: '#10b981',
    hexLight: '#ecfdf5',
    pillActive: 'bg-emerald-50 border-emerald-300 text-emerald-800',
    dot: 'bg-emerald-500',
    text: 'text-emerald-700 dark:text-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700',
    icon: Hammer,
  },
];

/** Quick lookup: phase id → PhaseConfig. */
export const PHASE_BY_ID: Record<ProjectPhase, PhaseConfig> = Object.fromEntries(
  PHASE_CONFIGS.map((p) => [p.id, p]),
) as Record<ProjectPhase, PhaseConfig>;

/**
 * Map legacy stage keys (from MARS ProjectCounts) to canonical phase ids.
 *
 * MARS uses "assessed" and "sketches" in its count fields. This map
 * normalises those to the canonical phase names used everywhere else.
 *
 * @example
 * STAGE_TO_PHASE['assessed']  // 'preliminary'
 * STAGE_TO_PHASE['sketches']  // 'sketch'
 */
export const STAGE_TO_PHASE: Record<string, ProjectPhase> = {
  sketch: 'sketch',
  sketches: 'sketch',
  preliminary: 'preliminary',
  assessed: 'preliminary',
  approved: 'approved',
  established: 'established',
};

/**
 * Get the PhaseConfig for a phase string, with fallback for legacy keys.
 *
 * @param phase - Phase id or legacy stage key
 * @returns Matching PhaseConfig, or the sketch config as safe fallback
 *
 * @example
 * getPhaseConfig('preliminary').label  // "Forundersøgelse"
 * getPhaseConfig('assessed').label     // "Forundersøgelse"
 */
export function getPhaseConfig(phase: string): PhaseConfig {
  const canonical = STAGE_TO_PHASE[phase] ?? phase;
  return PHASE_BY_ID[canonical as ProjectPhase] ?? PHASE_BY_ID.sketch;
}
