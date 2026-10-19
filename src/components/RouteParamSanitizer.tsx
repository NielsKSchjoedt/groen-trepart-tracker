import { useRouteParamSanitizer } from '@/lib/permalink/useRouteParamSanitizer';

/** Ensures URL query params match the active route's permalink schema. */
export function RouteParamSanitizer() {
  useRouteParamSanitizer();
  return null;
}
