import type { NavigateFunction } from 'react-router-dom';
import { kommuneToSlug } from './kommune-slugs';
import { extractKommuneDetailSearch } from '@/lib/permalink/route-params';

const KOMMUNE_LIST_RETURN_KEY = 'gt-kommune-list-return';

export interface KommuneListReturnState {
  scrollY: number;
  /** Query string when leaving the list (e.g. ?metric=kvælstof) */
  search: string;
}

/** Reset viewport scroll — used when opening a kommune detail page. */
export function scrollToPageTop(): void {
  window.scrollTo(0, 0);
}

function readReturnState(): KommuneListReturnState | null {
  try {
    const raw = sessionStorage.getItem(KOMMUNE_LIST_RETURN_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as KommuneListReturnState;
    if (typeof parsed.scrollY !== 'number') return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Remember list scroll position before opening a kommune detail page. */
export function saveKommuneListReturnState(search = window.location.search): void {
  try {
    const state: KommuneListReturnState = {
      scrollY: window.scrollY,
      search,
    };
    sessionStorage.setItem(KOMMUNE_LIST_RETURN_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage unavailable — back link still works without scroll restore
  }
}

/** Read saved return state without clearing it (for back-link target). */
export function peekKommuneListReturnState(): KommuneListReturnState | null {
  return readReturnState();
}

/** Read and clear saved return state — call once when the list page mounts. */
export function consumeKommuneListReturnState(): KommuneListReturnState | null {
  const state = readReturnState();
  if (state) {
    try {
      sessionStorage.removeItem(KOMMUNE_LIST_RETURN_KEY);
    } catch {
      /* ignore */
    }
  }
  return state;
}

/** Back-link target for the kommune detail page header. */
export function getKommuneListBackTarget(fallbackSearch = ''): {
  pathname: string;
  search: string;
} {
  const saved = peekKommuneListReturnState();
  return {
    pathname: '/kommuner',
    search: saved?.search ?? fallbackSearch,
  };
}

/**
 * Restore a previously saved scroll position after the list page has rendered.
 * Retries briefly while lazy content (map, tables) expands the document.
 */
export function restoreKommuneListScroll(scrollY: number, maxAttempts = 12): void {
  let attempts = 0;

  const tryScroll = () => {
    window.scrollTo({ top: scrollY, left: 0, behavior: 'instant' });
    attempts += 1;

    const pageTallEnough =
      document.documentElement.scrollHeight >= scrollY + window.innerHeight * 0.25;
    if (attempts < maxAttempts && !pageTallEnough) {
      requestAnimationFrame(tryScroll);
    }
  };

  requestAnimationFrame(tryScroll);
}

/** Navigate to a municipality detail page and scroll to the top. */
export function navigateToKommuneDetail(
  navigate: NavigateFunction,
  navn: string,
  search = '',
): void {
  saveKommuneListReturnState(search);
  scrollToPageTop();
  const detailSearch = extractKommuneDetailSearch(search);
  navigate({ pathname: `/kommuner/${kommuneToSlug(navn)}`, search: detailSearch });
}

/** Resolve kommune kode → detail page navigation with scroll reset. */
export function navigateToKommuneByKode(
  navigate: NavigateFunction,
  kode: string,
  kommuner: Array<{ kode: string; navn: string }>,
  search = '',
): void {
  const km = kommuner.find((k) => k.kode === kode);
  if (!km) return;
  navigateToKommuneDetail(navigate, km.navn, search);
}
