import { useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { X, Droplets, MapPin, Trees, Maximize2 } from 'lucide-react';
import { formatDanishNumber } from '@/lib/format';

export interface ProjectMapInfo {
  name: string;
  phase: string;
  phaseLabelDa: string;
  measureName?: string;
  schemeName?: string;
  schemeOrg?: string;
  areaHa?: number;
  nitrogenT?: number;
  extractionHa?: number;
  afforestationHa?: number;
}

interface ProjectMapOverlayProps {
  coordinates: [number, number][];
  info?: ProjectMapInfo;
  onClose: () => void;
}

/**
 * Full-screen modal overlay with an interactive Leaflet map showing
 * the project polygon. Supports zoom, pan, and displays project info.
 */
export function ProjectMapOverlay({ coordinates, info, onClose }: ProjectMapOverlayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  // Close on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    // Prevent body scroll while overlay is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  useEffect(() => {
    if (!containerRef.current || coordinates.length < 3) return;

    // Dispose previous
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    // Convert [lng, lat] → [lat, lng] for Leaflet
    const latLngs: L.LatLngExpression[] = coordinates.map(([lng, lat]) => [lat, lng]);

    const map = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      touchZoom: true,
      boxZoom: true,
      keyboard: true,
    });

    // Light basemap
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    }).addTo(map);

    // Draw the project polygon
    const polygon = L.polygon(latLngs, {
      color: '#166534',
      weight: 2.5,
      fillColor: '#22c55e',
      fillOpacity: 0.20,
    }).addTo(map);

    // Popup on the polygon
    if (info) {
      const popupHtml = buildPopupHtml(info);
      polygon.bindPopup(popupHtml, {
        maxWidth: 300,
        className: 'project-popup',
      }).openPopup();
    }

    // Fit to polygon bounds
    const bounds = polygon.getBounds();
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 16 });

    mapRef.current = map;

    // Force Leaflet to recalculate size after render
    setTimeout(() => map.invalidateSize(), 50);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [coordinates, info]);

  const phaseColors: Record<string, string> = {
    established: '#15803d',
    approved: '#a16207',
    preliminary: '#2563eb',
    sketch: '#6b7280',
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-sm">
        <div className="flex items-center gap-3 min-w-0">
          <Maximize2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground truncate">
              {info?.name ?? 'Projektområde'}
            </h3>
            {info && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span
                  className="font-medium"
                  style={{ color: phaseColors[info.phase] ?? '#6b7280' }}
                >
                  {info.phaseLabelDa}
                </span>
                {info.measureName && <span>· {info.measureName}</span>}
                {info.areaHa != null && info.areaHa > 0 && (
                  <span>· {formatDanishNumber(info.areaHa, 1)} ha</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Metric pills */}
        {info && (
          <div className="hidden sm:flex items-center gap-2 mx-4 flex-shrink-0">
            {(info.nitrogenT ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium">
                <Droplets className="w-3 h-3" />
                {formatDanishNumber(info.nitrogenT!, 2)} t N
              </span>
            )}
            {(info.extractionHa ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-xs font-medium">
                <MapPin className="w-3 h-3" />
                {formatDanishNumber(info.extractionHa!, 1)} ha
              </span>
            )}
            {(info.afforestationHa ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-50 text-green-700 text-xs font-medium">
                <Trees className="w-3 h-3" />
                {formatDanishNumber(info.afforestationHa!, 1)} ha
              </span>
            )}
          </div>
        )}

        <button
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0"
          aria-label="Luk kortoversigt"
        >
          <X className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {/* Map container fills remaining space */}
      <div ref={containerRef} className="flex-1" />
    </div>,
    document.body
  );
}

function buildPopupHtml(info: ProjectMapInfo): string {
  const lines: string[] = [];
  lines.push(`<div style="font-family:system-ui,sans-serif;font-size:12px;line-height:1.5">`);
  lines.push(`<div style="font-weight:600;font-size:13px;margin-bottom:4px">${escHtml(info.name)}</div>`);
  lines.push(`<div style="color:#666;margin-bottom:6px">${escHtml(info.phaseLabelDa)}${info.measureName ? ' · ' + escHtml(info.measureName) : ''}</div>`);

  if ((info.areaHa ?? 0) > 0) {
    lines.push(`<div>Areal: <strong>${formatDanishNumber(info.areaHa!, 1)} ha</strong></div>`);
  }
  if ((info.nitrogenT ?? 0) > 0) {
    lines.push(`<div>N-reduktion: <strong>${formatDanishNumber(info.nitrogenT!, 3)} ton</strong></div>`);
  }
  if ((info.extractionHa ?? 0) > 0) {
    lines.push(`<div>Udtaget: <strong>${formatDanishNumber(info.extractionHa!, 1)} ha</strong></div>`);
  }
  if ((info.afforestationHa ?? 0) > 0) {
    lines.push(`<div>Skov: <strong>${formatDanishNumber(info.afforestationHa!, 1)} ha</strong></div>`);
  }
  if (info.schemeName) {
    lines.push(`<div style="margin-top:4px;color:#666">${escHtml(info.schemeName)}${info.schemeOrg ? ' (' + escHtml(info.schemeOrg) + ')' : ''}</div>`);
  }
  lines.push('</div>');
  return lines.join('');
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
