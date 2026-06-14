/**
 * Headless tier-1 MARS project renderer for Leaflet maps (dots / polygons by zoom).
 */
import { useEffect, useState } from 'react';
import L from 'leaflet';
import type { ProjectNatureOverlapData } from '@/lib/types';
import type { PillarId } from '@/lib/pillars';
import type { ProjectPhase } from '@/lib/phase-config';
import { getPhaseConfig } from '@/lib/phase-config';
import { formatDanishNumber } from '@/lib/format';
import {
  MAP_PROJECT_POLYGON_ZOOM,
  type MapProjectItem,
  projectMarkerRadius,
  ringCentroid,
} from '@/lib/map-projects';

interface MapProjectLayerProps {
  map: L.Map | null;
  enabled: boolean;
  projects: MapProjectItem[];
  geometries: Record<string, [number, number][]> | null;
  /** Nature-pillar overlap tooltips (optional). */
  natureOverlap?: ProjectNatureOverlapData | null;
  activePillar?: PillarId | null;
  paneName?: string;
  /** Called when a project dot or polygon is clicked. */
  onProjectClick?: (geoId: string, lng: number, lat: number) => void;
}

export function MapProjectLayer({
  map,
  enabled,
  projects,
  geometries,
  natureOverlap = null,
  activePillar = null,
  paneName = 'marsProjects',
  onProjectClick,
}: MapProjectLayerProps) {
  const [zoom, setZoom] = useState(7);

  useEffect(() => {
    if (!map) return;
    const sync = () => setZoom(map.getZoom());
    sync();
    map.on('zoomend', sync);
    return () => {
      map.off('zoomend', sync);
    };
  }, [map]);

  useEffect(() => {
    if (!map || !enabled || !geometries) return;

    const withGeom = projects.filter((p) => {
      const ring = geometries[p.geoId];
      return ring && ring.length >= 3;
    });

    if (withGeom.length === 0) return;

    if (!map.getPane(paneName)) {
      const pane = map.createPane(paneName);
      pane.style.zIndex = '660';
    }

    const group = L.layerGroup();
    const usePolygons = zoom >= MAP_PROJECT_POLYGON_ZOOM;
    const maxArea = Math.max(...withGeom.map((p) => p.areaHa), 1);

    for (const proj of withGeom) {
      const ring = geometries[proj.geoId]!;
      const phaseCfg = getPhaseConfig(proj.phase);
      const color = phaseCfg.hex;
      const [lng, lat] = ringCentroid(ring);

      const tooltipLines = [`<strong>${proj.name}</strong>`, phaseCfg.label];
      if (proj.measureName) tooltipLines.push(proj.measureName);
      const areaStr = proj.areaHa < 10
        ? formatDanishNumber(proj.areaHa, 1)
        : formatDanishNumber(Math.round(proj.areaHa), 0);
      tooltipLines.push(`${areaStr} ha`);

      const ov = natureOverlap?.byProject[proj.geoId];
      if (ov && activePillar === 'nature') {
        if (ov.biodiversitetHa > 0) {
          tooltipLines.push(`Biodiversitetskort: ${formatDanishNumber(ov.biodiversitetHa, 1)} ha`);
        }
        if (ov.section3Ha > 0) {
          tooltipLines.push(`§3: ${formatDanishNumber(ov.section3Ha, 1)} ha`);
        }
        if (ov.natura2000Ha > 0) {
          tooltipLines.push(`Natura 2000: ${formatDanishNumber(ov.natura2000Ha, 1)} ha`);
        }
      }

      let layer: L.Layer;
      const bindClick = (leafletLayer: L.Layer) => {
        if (!onProjectClick) return;
        leafletLayer.on('click', (e: L.LeafletMouseEvent) => {
          L.DomEvent.stopPropagation(e);
          onProjectClick(proj.geoId, lng, lat);
        });
      };

      if (usePolygons) {
        layer = L.geoJSON(
          {
            type: 'Feature',
            properties: {},
            geometry: { type: 'Polygon', coordinates: [ring] },
          },
          {
            pane: paneName,
            style: {
              fillColor: color,
              fillOpacity: 0.3,
              color,
              weight: 1.5,
              opacity: 0.9,
            },
            onEachFeature: (_feature, featureLayer) => {
              bindClick(featureLayer);
            },
          },
        );
      } else {
        layer = L.circleMarker([lat, lng], {
          radius: projectMarkerRadius(proj.areaHa, maxArea),
          weight: 1.5,
          color,
          fillColor: color,
          fillOpacity: 0.75,
          opacity: 0.95,
          pane: paneName,
          bubblingMouseEvents: false,
        });
        bindClick(layer);
      }

      layer.bindTooltip(tooltipLines.join('<br>'), { sticky: true, className: 'map-tooltip' });
      group.addLayer(layer);
    }

    group.addTo(map);
    return () => {
      map.removeLayer(group);
    };
  }, [map, enabled, projects, geometries, zoom, natureOverlap, activePillar, paneName, onProjectClick]);

  return null;
}
