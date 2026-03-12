import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Maximize2 } from 'lucide-react';

interface ProjectMiniMapProps {
  /** Polygon ring as [[lng, lat], [lng, lat], ...] */
  coordinates: [number, number][];
  /** Height in pixels (default 180) */
  height?: number;
  /** Callback when the map is clicked to open the full overlay */
  onClick?: () => void;
}

/**
 * Lightweight Leaflet mini-map showing a single project polygon.
 * When `onClick` is provided, the map becomes clickable with a
 * visual hint to expand into a full-screen overlay.
 */
export function ProjectMiniMap({ coordinates, height = 180, onClick }: ProjectMiniMapProps) {
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
    <div className="relative group" style={{ height, width: '100%' }}>
      <div
        ref={containerRef}
        style={{ height: '100%', width: '100%', borderRadius: '8px', overflow: 'hidden' }}
        className="border border-gray-200"
      />
      {onClick && (
        <button
          onClick={(e) => { e.stopPropagation(); onClick(); }}
          className="absolute inset-0 rounded-lg cursor-pointer z-[400] flex items-center justify-center bg-transparent hover:bg-black/5 transition-colors"
          aria-label="Åbn kort i fuld størrelse"
        >
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm shadow-md text-xs font-medium text-gray-700 opacity-0 group-hover:opacity-100 transition-opacity">
            <Maximize2 className="w-3.5 h-3.5" />
            Åbn kort
          </span>
        </button>
      )}
    </div>
  );
}
