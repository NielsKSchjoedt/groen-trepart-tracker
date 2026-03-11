import { useEffect, useRef } from 'react';
import L from 'leaflet';

interface ProjectMiniMapProps {
  /** Polygon ring as [[lng, lat], [lng, lat], ...] */
  coordinates: [number, number][];
  /** Height in pixels (default 180) */
  height?: number;
}

/**
 * Lightweight Leaflet mini-map showing a single project polygon.
 * No tile layer — just a clean polygon on a subtle basemap.
 */
export function ProjectMiniMap({ coordinates, height = 180 }: ProjectMiniMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || coordinates.length < 3) return;

    // Dispose previous map instance
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Convert [lng, lat] → [lat, lng] for Leaflet
    const latLngs: L.LatLngExpression[] = coordinates.map(([lng, lat]) => [lat, lng]);

    const map = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      dragging: false,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
      keyboard: false,
    });

    // Light basemap (same as main map)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 18,
    }).addTo(map);

    // Draw the project polygon
    const polygon = L.polygon(latLngs, {
      color: '#166534',
      weight: 2,
      fillColor: '#22c55e',
      fillOpacity: 0.25,
    }).addTo(map);

    // Fit to polygon bounds with some padding
    const bounds = polygon.getBounds();
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 15 });

    mapRef.current = map;

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [coordinates]);

  if (coordinates.length < 3) return null;

  return (
    <div
      ref={containerRef}
      style={{ height, width: '100%', borderRadius: '8px', overflow: 'hidden' }}
      className="border border-gray-200"
    />
  );
}
