import type { Location } from 'react-router-dom';
import type { ViewState, RouteContext, RouteKind } from './types';
import { DEFAULT_VIEW_STATE } from './defaults';
import { parseSectionHash } from './slices/section';
import { decodeNationalMap, applyNationalMapToParams } from './slices/map-national';
import { decodePanels, applyPanelsToParams } from './slices/panels';
import { decodeProjectOpen, applyProjectOpenToParams } from './slices/project-open';
import { decodeProjectsMetric, applyProjectsMetricToParams } from './slices/projects';
import { decodeFremskrivning, applyFremskrivningToParams } from './slices/fremskrivning';
import { decodeStandings, applyStandingsToParams } from './slices/standings';
import { decodeKommuneMap, applyKommuneMapToParams } from './slices/map-kommune';
import { sanitizeSearchParamsForRoute } from './route-params';

export function resolveRouteContext(pathname: string): RouteContext {
  if (pathname === '/') return { kind: 'overview', pathname };
  if (pathname === '/kommuner') return { kind: 'kommune-list', pathname };
  if (/^\/kommuner\/[^/]+/.test(pathname)) return { kind: 'kommune-detail', pathname };
  const pillarSlugs = ['kvælstof', 'lavbund', 'skovrejsning', 'co2', 'natur'];
  if (pillarSlugs.some((s) => pathname === `/${s}`)) {
    return { kind: 'pillar', pathname };
  }
  return { kind: 'other', pathname };
}

/** Parse full view state from a router location — never throws. */
export function parseViewState(location: Pick<Location, 'pathname' | 'search' | 'hash'>): ViewState {
  const ctx = resolveRouteContext(location.pathname);
  const params = sanitizeSearchParamsForRoute(new URLSearchParams(location.search), ctx);

  const section = parseSectionHash(location.hash, params);
  if (section && params.has('fane')) {
    params.delete('fane');
  }

  const isKommuneRoute = ctx.kind === 'kommune-list' || ctx.kind === 'kommune-detail';
  const isNationalRoute = ctx.kind === 'overview' || ctx.kind === 'pillar';

  return {
    section,
    mapNational: isNationalRoute ? decodeNationalMap(params) : DEFAULT_VIEW_STATE.mapNational,
    mapKommune: isKommuneRoute ? decodeKommuneMap(params) : null,
    panels: isNationalRoute ? decodePanels(params) : DEFAULT_VIEW_STATE.panels,
    projectOpen:
      isNationalRoute || ctx.kind === 'kommune-list' || ctx.kind === 'kommune-detail'
        ? decodeProjectOpen(params)
        : null,
    projectsMetric: isNationalRoute
      ? decodeProjectsMetric(params)
      : DEFAULT_VIEW_STATE.projectsMetric,
    fremskrivning: isNationalRoute
      ? decodeFremskrivning(params)
      : DEFAULT_VIEW_STATE.fremskrivning,
    standings: ctx.kind === 'kommune-list' ? decodeStandings(params) : DEFAULT_VIEW_STATE.standings,
  };
}

/** Encode view state slices into search params; omits defaults. */
export function toSearchParams(
  state: Partial<ViewState>,
  ctx: RouteContext,
  existing?: URLSearchParams,
): URLSearchParams {
  const base = existing
    ? sanitizeSearchParamsForRoute(new URLSearchParams(existing.toString()), ctx)
    : new URLSearchParams();
  const params = new URLSearchParams(base.toString());

  const isKommuneRoute = ctx.kind === 'kommune-list' || ctx.kind === 'kommune-detail';
  const isNationalRoute = ctx.kind === 'overview' || ctx.kind === 'pillar';

  if (state.mapNational && isNationalRoute) {
    applyNationalMapToParams(params, state.mapNational);
  }
  if (state.panels && isNationalRoute) {
    applyPanelsToParams(params, state.panels);
  }
  if (state.projectOpen !== undefined && (isNationalRoute || isKommuneRoute)) {
    applyProjectOpenToParams(params, state.projectOpen);
  }
  if (state.projectsMetric && isNationalRoute) {
    applyProjectsMetricToParams(params, state.projectsMetric);
  }
  if (state.fremskrivning && isNationalRoute) {
    applyFremskrivningToParams(params, state.fremskrivning);
  }
  if (state.standings && ctx.kind === 'kommune-list') {
    applyStandingsToParams(params, state.standings);
  }
  if (state.mapKommune && isKommuneRoute) {
    applyKommuneMapToParams(params, state.mapKommune);
  }

  return sanitizeSearchParamsForRoute(params, ctx);
}

/** Build a full shareable URL from current origin + view state. */
export function buildPermalink(
  origin: string,
  pathname: string,
  state: Partial<ViewState>,
  ctx?: RouteContext,
): string {
  const routeCtx = ctx ?? resolveRouteContext(pathname);
  const params = toSearchParams(state, routeCtx);
  const search = params.toString();
  const hash = state.section ? `#${state.section}` : '';
  return `${origin}${pathname}${search ? `?${search}` : ''}${hash}`;
}

export function getCurrentPermalink(): string {
  const { origin, pathname, search, hash } = window.location;
  const ctx = resolveRouteContext(pathname);
  const params = sanitizeSearchParamsForRoute(new URLSearchParams(search), ctx);
  const qs = params.toString();
  return `${origin}${pathname}${qs ? `?${qs}` : ''}${hash}`;
}

export { resolveRouteContext as getRouteKind };
export type { RouteKind };
