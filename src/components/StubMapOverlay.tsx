import { MapPinOff } from 'lucide-react';

interface StubMapOverlayProps {
  /** Danish message explaining why data is unavailable */
  message: string;
}

/**
 * Non-dismissable overlay rendered on top of the Leaflet map container
 * when the active pillar has no geographic data (currently only CO₂).
 */
export function StubMapOverlay({ message }: StubMapOverlayProps) {
  return (
    <div className="absolute inset-0 z-[1000] flex items-center justify-center bg-background/70 backdrop-blur-[3px] rounded-2xl">
      <div className="text-center max-w-sm px-8">
        <div className="w-12 h-12 rounded-full bg-muted border border-border flex items-center justify-center mx-auto mb-4">
          <MapPinOff className="w-5 h-5 text-muted-foreground" />
        </div>
        <p className="text-sm font-semibold text-foreground mb-1.5">
          Ingen geografisk data
        </p>
        <p className="text-xs text-muted-foreground leading-relaxed">{message}</p>
      </div>
    </div>
  );
}
