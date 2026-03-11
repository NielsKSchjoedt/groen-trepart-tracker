import { CloudOff } from 'lucide-react';

interface StubMapOverlayProps {
  /** Danish message explaining why data is unavailable */
  message: string;
}

/**
 * Semi-transparent overlay rendered on top of the Leaflet map container
 * when the active pillar has no geographic data (currently only CO₂).
 */
export function StubMapOverlay({ message }: StubMapOverlayProps) {
  return (
    <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-2xl">
      <div className="text-center max-w-xs px-6">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <CloudOff className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
