import { useEffect, useMemo, useState } from 'react';
import type { FeatureCollection, Geometry } from 'geojson';
import { ChapterSection } from '@/components/ChapterSection';
import { KommuneMapSection } from '@/components/KommuneMapSection';
import { loadKommunerGeoJSON } from '@/lib/data';
import { GEOGRAFI_CHAPTER } from '@/lib/chapters';
import { DEFAULT_KOMMUNE_MAP_OVERLAYS } from '@/lib/kommune-map-overlays';
import { buildFilteredKommuner, DEFAULT_PHASES } from '@/lib/kommune-metrics';
import type { PillarId } from '@/lib/pillars';
import type { DashboardData } from '@/lib/types';

interface DelmaalVaelgKortProps {
  data: DashboardData;
  onSelect: (id: PillarId) => void;
}

const OVERVIEW_MAP_INTRO =
  'Vælg et delmål for at farvelægge kortet og dykke ned i projekter, tabeller og fremskrivninger.';

/**
 * Map pick section on the national overview — same shell as the kommune kort
 * (blurred map + delmål dots), placed between hero and økonomi.
 */
export function DelmaalVaelgKort({ data, onSelect }: DelmaalVaelgKortProps) {
  const [kommunerGeo, setKommunerGeo] = useState<FeatureCollection<Geometry> | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    loadKommunerGeoJSON()
      .then((geo) => {
        if (cancelled) return;
        if (geo) setKommunerGeo(geo);
        else setLoadError('Kommune-grænser kunne ikke indlæses.');
      })
      .catch(() => {
        if (!cancelled) setLoadError('Kommune-grænser kunne ikke indlæses.');
      });
    return () => { cancelled = true; };
  }, []);

  const kommunerFiltered = useMemo(
    () => buildFilteredKommuner(data.national.byKommune, DEFAULT_PHASES, new Set()),
    [data],
  );

  return (
    <ChapterSection
      id="kort-udforsk"
      eyebrow={GEOGRAFI_CHAPTER.eyebrow}
      question={GEOGRAFI_CHAPTER.question}
      intro={OVERVIEW_MAP_INTRO}
      className="pb-2"
    >
      <div className="mx-auto max-w-6xl px-4">
        <KommuneMapSection
          activeMetric={null}
          kommunerGeo={kommunerGeo}
          kommunerFiltered={kommunerFiltered}
          loadError={loadError}
          fordelingSimulation={null}
          kommuneBenchmark={null}
          fordelingViewMode="actual"
          onFordelingViewModeChange={() => {}}
          choroplethScale="absolute"
          onChoroplethScaleChange={() => {}}
          kommuneRanking={null}
          ansvarIndexByKode={{}}
          natureLayer="b4-beskyttet"
          onNatureLayerChange={() => {}}
          onSelect={() => {}}
          onMetricChange={(metric) => onSelect(metric as PillarId)}
          metricPickHint="Projekter, kort og fremskrivninger vises, når du har valgt et delmål."
          dashboard={data}
          selectedPhases={DEFAULT_PHASES}
          mapOverlays={DEFAULT_KOMMUNE_MAP_OVERLAYS}
          onMapOverlaysChange={() => {}}
          readOnly
          inlineMapHeight="580px"
        />
      </div>
    </ChapterSection>
  );
}
