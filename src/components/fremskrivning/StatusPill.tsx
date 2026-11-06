import type { FremskrivningStatusMeta } from '@/lib/fremskrivning';

interface StatusPillProps {
  status: FremskrivningStatusMeta;
  size?: 'md' | 'lg';
}

export function StatusPill({ status, size = 'md' }: StatusPillProps) {
  const pad = size === 'lg' ? 'px-3.5 py-1.5 text-sm' : 'px-2.5 py-1 text-xs';
  const dotSize = size === 'lg' ? 'w-[18px] h-[18px] text-[10px]' : 'w-4 h-4 text-[9px]';

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold rounded-full whitespace-nowrap border ${pad}`}
      style={{
        backgroundColor: status.pillBg,
        borderColor: status.pillBorder,
        color: status.color,
      }}
    >
      <span
        className={`inline-flex items-center justify-center rounded-full text-white leading-none ${dotSize}`}
        style={{ backgroundColor: status.pillBorder }}
      >
        {status.icon}
      </span>
      {status.label}
    </span>
  );
}
