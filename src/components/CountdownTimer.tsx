import { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';
import { formatDanishNumber } from '@/lib/format';
import { InfoTooltip } from './InfoTooltip';

interface CountdownTimerProps {
  deadline: string;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/**
 * Displays a live countdown clock to the given deadline date.
 * Updates every second. Renders the deadline label, digital clock,
 * and an info tooltip explaining how the projection works.
 *
 * @param deadline - ISO date string for the target deadline (e.g. "2030-12-31")
 */
export function CountdownTimer({ deadline }: CountdownTimerProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const deadlineDate = new Date(deadline);
  const diffMs = Math.max(0, deadlineDate.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const timeUnits = [
    { value: days, label: 'dage' },
    { value: hours, label: 'timer' },
    { value: minutes, label: 'min' },
    { value: seconds, label: 'sek' },
  ];

  return (
    <div className="w-full max-w-lg mx-auto">
      <div className="flex items-center justify-center gap-1.5 mb-2">
        <Clock className="w-3.5 h-3.5 text-primary" />
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          Tid til deadline — {deadlineDate.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
        <InfoTooltip
          title="Nedtælling"
          content={
            <p>Nedtællingen viser tid til det valgte delmåls deadline. Brug scenariebyggeren nedenfor for at se prognosen.</p>
          }
          size={12}
          side="bottom"
        />
      </div>

      <div className="flex items-center justify-center gap-2">
        {timeUnits.map((tu, i) => (
          <div key={tu.label} className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <span
                className="text-2xl md:text-3xl font-bold tabular-nums text-foreground leading-none"
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                {tu.label === 'dage' ? formatDanishNumber(tu.value) : pad(tu.value)}
              </span>
              <span className="text-[10px] text-muted-foreground mt-1">{tu.label}</span>
            </div>
            {i < timeUnits.length - 1 && (
              <span className="text-lg text-muted-foreground/40 font-light -mt-3">:</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
