import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { resolveRouteContext } from './compose';
import { sanitizeSearchParamsForRoute } from './route-params';

/**
 * Strip query params that do not belong on the current route (replace, no history entry).
 * Fixes stale national/list state when landing on kommune detail pages via bookmark or back nav.
 */
export function useRouteParamSanitizer(): void {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const ctx = resolveRouteContext(location.pathname);
    const current = new URLSearchParams(location.search);
    const clean = sanitizeSearchParamsForRoute(current, ctx);
    if (current.toString() === clean.toString()) return;

    navigate(
      {
        pathname: location.pathname,
        search: clean.toString() ? `?${clean.toString()}` : '',
        hash: location.hash,
      },
      { replace: true },
    );
  }, [location.pathname, location.search, location.hash, navigate]);
}
