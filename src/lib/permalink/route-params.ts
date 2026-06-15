import type { RouteContext, RouteKind } from './types';
import { PERMALINK_KEYS } from './schema';

/** Kommune map controls shared by list and detail pages. */
export const KOMMUNE_MAP_PARAM_KEYS = [
  'metric',
  'faser',
  'tilvalg',
  'vis',
  'skala',
  'natur',
  'overlag',
] as const;

const NATIONAL_PAGE_PARAM_KEYS = [
  PERMALINK_KEYS.kort,
  PERMALINK_KEYS.overlag,
  PERMALINK_KEYS.faser,
  PERMALINK_KEYS.fuldskaerm,
  PERMALINK_KEYS.projektenhed,
  PERMALINK_KEYS.frem,
  PERMALINK_KEYS.projekt,
  PERMALINK_KEYS.opland,
  PERMALINK_KEYS.plan,
  PERMALINK_KEYS.kystvand,
  PERMALINK_KEYS.vandplan,
  PERMALINK_KEYS.lag,
  PERMALINK_KEYS.bio,
  PERMALINK_KEYS.vns,
  PERMALINK_KEYS.fane,
] as const;

const KOMMUNE_LIST_PARAM_KEYS = [
  ...KOMMUNE_MAP_PARAM_KEYS,
  PERMALINK_KEYS.sort,
  PERMALINK_KEYS.visning,
  PERMALINK_KEYS.region,
  PERMALINK_KEYS.projekt,
  PERMALINK_KEYS.fane,
] as const;

const KOMMUNE_DETAIL_PARAM_KEYS = [
  ...KOMMUNE_MAP_PARAM_KEYS,
  // `visning` is shared with the list so the Mod målet / Ift. ansvar / Absolut
  // lens persists when opening a kommune detail page (the "Hvor står?" section).
  PERMALINK_KEYS.visning,
  PERMALINK_KEYS.projekt,
  PERMALINK_KEYS.fane,
] as const;

const ROUTE_QUERY_ALLOWLIST: Record<RouteKind, readonly string[]> = {
  overview: NATIONAL_PAGE_PARAM_KEYS,
  pillar: NATIONAL_PAGE_PARAM_KEYS,
  'kommune-list': KOMMUNE_LIST_PARAM_KEYS,
  'kommune-detail': KOMMUNE_DETAIL_PARAM_KEYS,
  other: [],
};

/** Query param keys permitted on the given route. */
export function allowedQueryKeysForRoute(kind: RouteKind): ReadonlySet<string> {
  return new Set(ROUTE_QUERY_ALLOWLIST[kind]);
}

/** Drop query params that do not belong on this route. */
export function sanitizeSearchParamsForRoute(
  params: URLSearchParams,
  ctx: Pick<RouteContext, 'kind'>,
): URLSearchParams {
  const allowed = allowedQueryKeysForRoute(ctx.kind);
  const next = new URLSearchParams();
  for (const [key, value] of params.entries()) {
    if (allowed.has(key)) next.set(key, value);
  }
  return next;
}

/** Search string to carry when opening a kommune detail page from the list. */
export function extractKommuneDetailSearch(search: string): string {
  const raw = search.startsWith('?') ? search.slice(1) : search;
  const params = sanitizeSearchParamsForRoute(
    new URLSearchParams(raw),
    { kind: 'kommune-detail' },
  );
  // Never inherit an open project from the national list — validate locally on detail.
  params.delete(PERMALINK_KEYS.projekt);
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}
