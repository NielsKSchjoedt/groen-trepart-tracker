import { Switch } from '@/components/ui/switch';

interface MapSwitchToggleProps {
  label: string;
  description?: string;
  /** Dot colour mirroring the source on the map. */
  color?: string;
  checked: boolean;
  onChange: (on: boolean) => void;
}

/** Compact label + switch row — same pattern as toggles in the Lag panel. */
export function MapSwitchToggle({
  label,
  description,
  color,
  checked,
  onChange,
}: MapSwitchToggleProps) {
  return (
    <div
      className="flex items-center gap-2 text-[11px]"
      title={description}
    >
      {color && (
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full border border-black/10"
          style={{ backgroundColor: color }}
        />
      )}
      <span className="font-medium text-foreground leading-tight whitespace-nowrap">{label}</span>
      <Switch
        size="sm"
        checked={checked}
        onCheckedChange={onChange}
        className="data-[state=checked]:bg-primary shrink-0"
        aria-label={label}
      />
    </div>
  );
}
