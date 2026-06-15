import { useMemo, useCallback } from 'react';
import type { SetStateAction } from 'react';
import { type BiodivWmsId, parseBioParam, serializeBioParam } from '@/lib/biodiv-map';

const PARAM_BIO = 'bio';
const PARAM_VNS = 'vns';

interface BiodivSearchProps {
  searchParams: URLSearchParams;
  setSearchParams: (u: SetStateAction<URLSearchParams>) => void;
}

/**
 * Hook that reads/writes the biodiversity layer state from the URL.
 *
 * - `?bio=` : comma-separated list of active WMS layer ids
 * - `?vns=1`: Vand/Natur/Skov 2026 vector overlay on
 *
 * Returns the active set plus setters that patch the URL search params,
 * preserving deep-linkable map state.
 *
 * @example
 * const { bioActive, vnsOn, setBio, setVns } = useBiodivSearch({ searchParams, setSearchParams });
 */
export function useBiodivSearch({ searchParams, setSearchParams }: BiodivSearchProps) {
  const bioActive = useMemo(
    () => parseBioParam(searchParams.get(PARAM_BIO)),
    [searchParams],
  );
  const vnsOn = searchParams.get(PARAM_VNS) === '1';

  const setBio = useCallback(
    (id: BiodivWmsId, on: boolean) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        const cur = new Set(parseBioParam(next.get(PARAM_BIO)));
        if (on) cur.add(id);
        else cur.delete(id);
        const s = serializeBioParam([...cur] as BiodivWmsId[]);
        if (s) next.set(PARAM_BIO, s);
        else next.delete(PARAM_BIO);
        return next;
      });
    },
    [setSearchParams],
  );

  const setVns = useCallback(
    (on: boolean) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (on) next.set(PARAM_VNS, '1');
        else next.delete(PARAM_VNS);
        return next;
      });
    },
    [setSearchParams],
  );

  return { bioActive, vnsOn, setBio, setVns };
}
