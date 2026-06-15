import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import type { FeatureCollection, Geometry } from 'geojson';
import type { KommuneMetric, SupplementSource } from '@/lib/kommune-metrics';
import type { NationalOverlayToken } from '@/lib/permalink/types';
import { overlaysToBooleans } from '@/lib/permalink/useNationalMapPermalink';
import type { KlimaskovfondenProject, NaturstyrelsenSkovProject, CoastalWaterStatusData } from '@/lib/types';
import {
  loadNatura2000MapGeo,
  loadSection3MapGeo,
  loadWaterBodiesGeoJSON,
  loadCoastalWaterStatus,
} from '@/lib/data';
import { KSF_COLOR_LAVBUND, KSF_COLOR_SKOV, NST_COLOR, SECTION3_COLOR } from '@/lib/supplement-colors';
import type { SelectedProject } from '@/lib/project-selection';
import { BiodivLayers } from '@/components/DenmarkMapBiodiv';
import type { BiodivWmsId } from '@/lib/biodiv-map';
import {
  CRS_25832,
  DRIKKEVAND_WMS,
  KULSTOF_LAVBUND_WMS,
  MARKUDLEDNING_WMS,
  NATURPOTENTIALE_WMS,
} from '@/lib/map-overlay-wms';
import { getWfdStatusColor } from '@/lib/format';
import { kommuneMetricToLagPillar, isKommuneMapStubMetric } from '@/lib/kommune-map-overlays';

interface KommuneMapOverlayLayersProps {
  map: L.Map | null;
  activeMetric: KommuneMetric;
  mapOverlays: Set<NationalOverlayToken>;
  /** KSF/NST markers follow supplement toggles — not Lag panel. */
  activeSupplements: Set<SupplementSource>;
  ksfProjects: KlimaskovfondenProject[];
  nstProjects: NaturstyrelsenSkovProject[];
  onSupplementClick: (selection: SelectedProject, lng: number, lat: number) => void;
}

function addKsfMarkers(
  map: L.Map,
  projects: KlimaskovfondenProject[],
  onClick: KommuneMapOverlayLayersProps['onSupplementClick'],
): L.LayerGroup {
  const group = L.layerGroup();
  const maxArea = Math.max(...projects.map((p) => p.areaHa), 1);

  for (const proj of projects) {
    const [lon, lat] = proj.centroid;
    if (!lat || !lon) continue;

    const radius = Math.max(4, Math.min(14, 4 + 10 * Math.sqrt(proj.areaHa / maxArea)));
    const isSkov = proj.projekttyp === 'Skovrejsning';
    const ksfColor = isSkov ? KSF_COLOR_SKOV : KSF_COLOR_LAVBUND;
    const color = ksfColor.stroke;

    const marker = L.circleMarker([lat, lon], {
      radius,
      weight: 1.5,
      color,
      fillColor: color,
      fillOpacity: 0.7,
      opacity: 0.9,
      pane: 'markerPane',
      bubblingMouseEvents: false,
    });

    const areaStr = proj.areaHa < 10
      ? proj.areaHa.toFixed(1).replace('.', ',')
      : Math.round(proj.areaHa).toLocaleString('da-DK');
    const typeLabel = isSkov ? 'Skovrejsning' : 'Lavbundsprojekt';
    const statusLabel = isSkov ? 'Anlagt (frivillig skovrejsning)' : 'Anlagt (lavbundsudtag)';
    const kommuneStr = proj.kommune ? ` · ${proj.kommune}` : '';
    marker.bindTooltip(
      `<strong>Klimaskovfonden ${proj.sagsnummer}</strong><br/>${typeLabel} · ${areaStr} ha${kommuneStr} · ${proj.aargang}<br/><span style="opacity:0.7">${statusLabel}</span>`,
      { sticky: true, className: 'map-tooltip' },
    );

    marker.on('click', () => {
      onClick({ source: 'klimaskovfonden', project: proj }, lon, lat);
    });

    group.addLayer(marker);
  }

  group.addTo(map);
  return group;
}

function addNstMarkers(
  map: L.Map,
  projects: NaturstyrelsenSkovProject[],
  onClick: KommuneMapOverlayLayersProps['onSupplementClick'],
): L.LayerGroup {
  const group = L.layerGroup();
  const matched = projects.filter((p) => p.centroid);
  const maxArea = Math.max(...matched.map((p) => p.areaHa ?? 0), 1);

  for (const proj of matched) {
    const [lon, lat] = proj.centroid!;
    if (!lat || !lon) continue;

    const area = proj.areaHa ?? 0;
    const radius = Math.max(4, Math.min(14, 4 + 10 * Math.sqrt(area / maxArea)));
    const color = NST_COLOR.stroke;

    const marker = L.circleMarker([lat, lon], {
      radius,
      weight: 1.5,
      color,
      fillColor: color,
      fillOpacity: 0.7,
      opacity: 0.9,
      pane: 'markerPane',
      bubblingMouseEvents: false,
    });

    const areaStr = area > 0
      ? area < 10
        ? area.toFixed(1).replace('.', ',')
        : Math.round(area).toLocaleString('da-DK')
      : 'ukendt';
    const statusLabel = proj.status === 'ongoing' ? 'Igangværende' : 'Afsluttet';
    const districtStr = proj.district ? ` · ${proj.district}` : '';

    marker.bindTooltip(
      `<strong>${proj.name}</strong><br/>Naturstyrelsen${districtStr} · ${areaStr} ha<br/><span style="opacity:0.7">${statusLabel}</span>`,
      { sticky: true, className: 'map-tooltip' },
    );

    marker.on('click', () => {
      onClick({ source: 'naturstyrelsen', project: proj }, lon, lat);
    });

    group.addLayer(marker);
  }

  group.addTo(map);
  return group;
}

/**
 * National-equivalent WMS/GeoJSON Lag layers + KSF/NST markers from supplement toggles.
 */
export function KommuneMapOverlayLayers({
  map,
  activeMetric,
  mapOverlays,
  activeSupplements,
  ksfProjects,
  nstProjects,
  onSupplementClick,
}: KommuneMapOverlayLayersProps) {
  const pillarId = kommuneMetricToLagPillar(activeMetric);
  const isStub = isKommuneMapStubMetric(activeMetric);
  const flags = useMemo(() => overlaysToBooleans(mapOverlays), [mapOverlays]);
  const bioActive: BiodivWmsId[] = flags.bioActive ? ['maalretning-30'] : [];

  const ksfLayerRef = useRef<L.LayerGroup | null>(null);
  const nstLayerRef = useRef<L.LayerGroup | null>(null);
  const section3LayerRef = useRef<L.GeoJSON | null>(null);
  const natura2000LayerRef = useRef<L.GeoJSON | null>(null);
  const waterBodiesLayerRef = useRef<L.GeoJSON | null>(null);
  const markudledningLayerRef = useRef<L.TileLayer.WMS | null>(null);
  const drikkevandLayerRef = useRef<L.TileLayer.WMS | null>(null);
  const naturpotentialeLayerRef = useRef<L.TileLayer.WMS | null>(null);
  const kulstofLavbundLayerRef = useRef<L.TileLayer.WMS | null>(null);

  const [section3Geo, setSection3Geo] = useState<FeatureCollection<Geometry> | null>(null);
  const [natura2000Geo, setNatura2000Geo] = useState<FeatureCollection<Geometry> | null>(null);
  const [waterBodiesGeo, setWaterBodiesGeo] = useState<FeatureCollection<Geometry> | null>(null);
  const [coastalStatus, setCoastalStatus] = useState<CoastalWaterStatusData | null>(null);

  const showKsf = activeSupplements.has('ksf');
  const showNst = activeSupplements.has('nst');

  const activeKsfProjects = useMemo(() => {
    if (!showKsf) return [];
    if (activeMetric === 'afforestation') {
      return ksfProjects.filter((p) => p.projekttyp === 'Skovrejsning');
    }
    if (activeMetric === 'extraction') {
      return ksfProjects.filter((p) => p.projekttyp === 'Lavbund');
    }
    return [];
  }, [showKsf, activeMetric, ksfProjects]);

  const activeNstProjects = useMemo(() => {
    if (!showNst || activeMetric !== 'afforestation') return [];
    return nstProjects.filter((p) => p.centroid);
  }, [showNst, activeMetric, nstProjects]);

  useEffect(() => {
    if (!flags.showWaterBodies) return;
    let cancelled = false;
    Promise.all([loadWaterBodiesGeoJSON(), loadCoastalWaterStatus()]).then(([geo, status]) => {
      if (cancelled) return;
      setWaterBodiesGeo(geo);
      setCoastalStatus(status);
    });
    return () => { cancelled = true; };
  }, [flags.showWaterBodies]);

  useEffect(() => {
    if (pillarId !== 'nature') return;
    let cancelled = false;
    Promise.all([loadSection3MapGeo(), loadNatura2000MapGeo()]).then(([s3, n2000]) => {
      if (cancelled) return;
      setSection3Geo(s3);
      setNatura2000Geo(n2000);
    });
    return () => { cancelled = true; };
  }, [pillarId]);

  useEffect(() => {
    if (!map) return;
    if (ksfLayerRef.current) {
      map.removeLayer(ksfLayerRef.current);
      ksfLayerRef.current = null;
    }
    if (activeKsfProjects.length === 0) return;
    ksfLayerRef.current = addKsfMarkers(map, activeKsfProjects, onSupplementClick);
    return () => {
      if (ksfLayerRef.current) {
        map.removeLayer(ksfLayerRef.current);
        ksfLayerRef.current = null;
      }
    };
  }, [map, activeKsfProjects, onSupplementClick]);

  useEffect(() => {
    if (!map) return;
    if (nstLayerRef.current) {
      map.removeLayer(nstLayerRef.current);
      nstLayerRef.current = null;
    }
    if (activeNstProjects.length === 0) return;
    nstLayerRef.current = addNstMarkers(map, activeNstProjects, onSupplementClick);
    return () => {
      if (nstLayerRef.current) {
        map.removeLayer(nstLayerRef.current);
        nstLayerRef.current = null;
      }
    };
  }, [map, activeNstProjects, onSupplementClick]);

  useEffect(() => {
    if (!map) return;
    if (waterBodiesLayerRef.current) {
      map.removeLayer(waterBodiesLayerRef.current);
      waterBodiesLayerRef.current = null;
    }
    if (!flags.showWaterBodies || !waterBodiesGeo || !coastalStatus) return;

    const waterLayer = L.geoJSON(waterBodiesGeo, {
      style: (feature) => {
        if (!feature) return {};
        const ecoStatus = feature.properties?.eco_status || 'Ukendt';
        return {
          fillColor: getWfdStatusColor(ecoStatus),
          fillOpacity: 0.55,
          weight: 1.5,
          color: '#4a90b8',
          opacity: 0.7,
        };
      },
      onEachFeature: (feature, featureLayer) => {
        const name = feature.properties?.ov_navn || 'Ukendt';
        const ecoStatus = feature.properties?.eco_status || 'Ukendt';
        const path = featureLayer as L.Path;
        path.bindTooltip(`${name}: ${ecoStatus} tilstand`, {
          sticky: true,
          className: 'map-tooltip',
        });
      },
    }).addTo(map);
    waterBodiesLayerRef.current = waterLayer;
  }, [map, flags.showWaterBodies, waterBodiesGeo, coastalStatus]);

  useEffect(() => {
    if (!map) return;
    if (markudledningLayerRef.current) {
      map.removeLayer(markudledningLayerRef.current);
      markudledningLayerRef.current = null;
    }
    if (!flags.showMarkudledning || pillarId !== 'nitrogen') return;
    if (!map.getPane('markudledningWms')) {
      const pane = map.createPane('markudledningWms');
      pane.style.zIndex = '250';
    }
    const wms = L.tileLayer.wms(MARKUDLEDNING_WMS.base, {
      layers: MARKUDLEDNING_WMS.layer,
      format: 'image/png',
      transparent: true,
      version: '1.3.0',
      opacity: 0.65,
      pane: 'markudledningWms',
      attribution: 'Danmarks Miljøportal · Markudledningskortet (SEGES)',
    });
    wms.addTo(map);
    markudledningLayerRef.current = wms;
  }, [map, flags.showMarkudledning, pillarId]);

  useEffect(() => {
    if (!map) return;
    if (drikkevandLayerRef.current) {
      map.removeLayer(drikkevandLayerRef.current);
      drikkevandLayerRef.current = null;
    }
    if (!flags.showDrikkevand || pillarId !== 'nitrogen') return;
    if (!map.getPane('drikkevandWms')) {
      const pane = map.createPane('drikkevandWms');
      pane.style.zIndex = '250';
    }
    const wms = L.tileLayer.wms(DRIKKEVAND_WMS.base, {
      layers: DRIKKEVAND_WMS.layer,
      format: 'image/png',
      transparent: true,
      version: '1.3.0',
      opacity: 0.6,
      pane: 'drikkevandWms',
      attribution: 'Danmarks Miljøportal',
    });
    wms.addTo(map);
    drikkevandLayerRef.current = wms;
  }, [map, flags.showDrikkevand, pillarId]);

  useEffect(() => {
    if (!map) return;
    if (naturpotentialeLayerRef.current) {
      map.removeLayer(naturpotentialeLayerRef.current);
      naturpotentialeLayerRef.current = null;
    }
    if (!flags.showNaturpotentiale || pillarId !== 'nature') return;
    if (!map.getPane('naturpotentialeWms')) {
      const pane = map.createPane('naturpotentialeWms');
      pane.style.zIndex = '250';
    }
    const wms = L.tileLayer.wms(NATURPOTENTIALE_WMS.base, {
      layers: NATURPOTENTIALE_WMS.layer,
      format: 'image/png',
      transparent: true,
      version: '1.3.0',
      opacity: 0.6,
      pane: 'naturpotentialeWms',
      attribution: 'Danmarks Miljøportal · MARS (SGAV)',
    });
    wms.addTo(map);
    naturpotentialeLayerRef.current = wms;
  }, [map, flags.showNaturpotentiale, pillarId]);

  useEffect(() => {
    if (!map) return;
    if (kulstofLavbundLayerRef.current) {
      map.removeLayer(kulstofLavbundLayerRef.current);
      kulstofLavbundLayerRef.current = null;
    }
    if (!flags.showKulstof || pillarId !== 'extraction') return;
    if (!map.getPane('kulstofLavbundWms')) {
      const pane = map.createPane('kulstofLavbundWms');
      pane.style.zIndex = '250';
    }
    const wms = L.tileLayer.wms(KULSTOF_LAVBUND_WMS.base, {
      layers: KULSTOF_LAVBUND_WMS.layer,
      format: 'image/png',
      transparent: true,
      version: '1.3.0',
      opacity: 0.6,
      pane: 'kulstofLavbundWms',
      crs: CRS_25832,
      attribution: 'Danmarks Miljøportal',
    });
    wms.addTo(map);
    kulstofLavbundLayerRef.current = wms;
  }, [map, flags.showKulstof, pillarId]);

  useEffect(() => {
    if (!map) return;
    if (natura2000LayerRef.current) {
      map.removeLayer(natura2000LayerRef.current);
      natura2000LayerRef.current = null;
    }
    if (!flags.showNatura2000 || pillarId !== 'nature' || !natura2000Geo) return;
    if (!map.getPane('natura2000Geo')) {
      const pane = map.createPane('natura2000Geo');
      pane.style.zIndex = '255';
    }
    const layer = L.geoJSON(natura2000Geo, {
      pane: 'natura2000Geo',
      style: {
        fillColor: '#1d4ed8',
        fillOpacity: 0.35,
        color: '#1d4ed8',
        weight: 0.5,
        opacity: 0.7,
      },
    });
    layer.addTo(map);
    natura2000LayerRef.current = layer;
  }, [map, flags.showNatura2000, pillarId, natura2000Geo]);

  useEffect(() => {
    if (!map) return;
    if (section3LayerRef.current) {
      map.removeLayer(section3LayerRef.current);
      section3LayerRef.current = null;
    }
    if (!flags.showSection3 || pillarId !== 'nature' || !section3Geo) return;
    if (!map.getPane('section3Geo')) {
      const pane = map.createPane('section3Geo');
      pane.style.zIndex = '254';
    }
    const layer = L.geoJSON(section3Geo, {
      pane: 'section3Geo',
      style: {
        fillColor: SECTION3_COLOR.stroke,
        fillOpacity: 0.3,
        color: SECTION3_COLOR.stroke,
        weight: 0.5,
        opacity: 0.7,
      },
    });
    layer.addTo(map);
    section3LayerRef.current = layer;
  }, [map, flags.showSection3, pillarId, section3Geo]);

  return (
    <BiodivLayers
      map={map}
      isStub={isStub}
      bioActive={bioActive}
      vnsOn={flags.vnsOn}
    />
  );
}
