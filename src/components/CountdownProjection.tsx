import { useState, useEffect } from 'react';
import { formatDanishNumber } from '@/lib/format';
import { TrendingUp, TrendingDown, Clock, Target } from 'lucide-react';
import { InfoTooltip } from './InfoTooltip';

interface CountdownProjectionProps {
  deadline: string;
  achieved: number;
  target: number;
  /** Short unit label (e.g. "ton", "ha") used in progress text */
  unit?: string;
  /** Pillar accent color for the progress bar */
  accentColor?: string;
  /** Approximate start date of tracking / agreement */
  trackingStart?: string;
}

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function CountdownProjection({
  deadline,
  achieved,
  target,
  unit = 'ton',
  accentColor,
  trackingStart = '2024-01-01',
}: CountdownProjectionProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const deadlineDate = new Date(deadline);
  const startDate = new Date(trackingStart);

  // Countdown
  const diffMs = Math.max(0, deadlineDate.getTime() - now.getTime());
  const totalSeconds = Math.floor(diffMs / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  // Projection: linear extrapolation
  const elapsedMs = now.getTime() - startDate.getTime();
  const totalWindowMs = deadlineDate.getTime() - startDate.getTime();
  const elapsedFraction = Math.max(0.001, elapsedMs / totalWindowMs);
  const projectedTotal = achieved / elapsedFraction;
  const projectedPct = target > 0 ? (projectedTotal / target) * 100 : 0;
  const onTrack = projectedTotal >= target;
  const deficit = target - projectedTotal;

  // How much per day we need vs how much per day we're doing
  const daysElapsed = Math.max(1, elapsedMs / (1000 * 60 * 60 * 24));
  const currentRate = achieved / daysElapsed; // ton/day
  const daysRemaining = Math.max(1, diffMs / (1000 * 60 * 60 * 24));
  const remaining = target - achieved;
  const requiredRate = remaining / daysRemaining; // ton/day needed
  const rateRatio = currentRate > 0 ? requiredRate / currentRate : Infinity;

  const timeUnits = [
    { value: days, label: 'dage' },
    { value: hours, label: 'timer' },
    { value: minutes, label: 'min' },
    { value: seconds, label: 'sek' },
  ];

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Countdown clock */}
      <div className="flex items-center justify-center gap-1.5 mb-2">
        <Clock className="w-3.5 h-3.5 text-primary" />
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          Tid til deadline — {deadlineDate.toLocaleDateString('da-DK', { day: 'numeric', month: 'long', year: 'numeric' })}
        </span>
        <InfoTooltip
          title="Nedtælling og prognose"
          content={
            <>
              <p>Nedtællingen viser tid til det valgte delmåls deadline.</p>
              <p><strong>Prognosen</strong> bruger lineær ekstrapolation: nuværende fremskridt divideret med den forbrugte tidsandel giver et estimat for, hvor meget der nås inden deadline.</p>
              <p>«Ikke på sporet» betyder at det nuværende tempo skal øges (vist som en x-faktor) for at nå målet.</p>
            </>
          }
          size={12}
          side="bottom"
        />
      </div>

      <div className="flex items-center justify-center gap-2 mb-6">
        {timeUnits.map((unit, i) => (
          <div key={unit.label} className="flex items-center gap-2">
            <div className="flex flex-col items-center">
              <span
                className="text-2xl md:text-3xl font-bold tabular-nums text-foreground leading-none"
                style={{ fontFamily: "'Fraunces', serif" }}
              >
                {unit.label === 'dage' ? formatDanishNumber(unit.value) : pad(unit.value)}
              </span>
              <span className="text-[10px] text-muted-foreground mt-1">{unit.label}</span>
            </div>
            {i < timeUnits.length - 1 && (
              <span className="text-lg text-muted-foreground/40 font-light -mt-3">:</span>
            )}
          </div>
        ))}
      </div>

      {/* Projection card */}
      <div className={`rounded-xl border p-4 transition-colors ${
        onTrack
          ? 'bg-green-50/50 border-green-200/60'
          : 'bg-orange-50/50 border-orange-200/60'
      }`}>
        <div className="flex items-start gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
            onTrack ? 'bg-green-100' : 'bg-orange-100'
          }`}>
            {onTrack ? (
              <TrendingUp className="w-4.5 h-4.5 text-green-600" />
            ) : (
              <TrendingDown className="w-4.5 h-4.5 text-orange-600" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold mb-0.5 ${onTrack ? 'text-green-800' : 'text-orange-800'}`}>
              {onTrack ? 'På sporet mod målet' : 'Ikke på sporet endnu'}
            </p>
            <p className={`text-xs leading-relaxed ${onTrack ? 'text-green-700/80' : 'text-orange-700/80'}`}>
              {onTrack ? (
                <>Med nuværende tempo rammer vi {formatDanishNumber(Math.round(projectedTotal))} {unit} — {Math.round(projectedPct)}% af målet.</>
              ) : (
                <>Med nuværende tempo når vi kun <strong>{formatDanishNumber(Math.round(projectedTotal))} {unit}</strong> ({Math.round(projectedPct)}% af målet). 
                  Vi skal <strong>{rateRatio.toFixed(1)}x</strong> hurtigere for at nå {formatDanishNumber(target)} {unit}.</>
              )}
            </p>
          </div>
        </div>

        {/* Visual projection bar */}
        <div className="mt-3.5">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>0 {unit}</span>
            <span className="flex items-center gap-1">
              <Target className="w-2.5 h-2.5" />
              {formatDanishNumber(target)} {unit}
            </span>
          </div>
          <div className="relative h-3 w-full rounded-full bg-muted overflow-hidden">
            {/* Projected (ghost bar) */}
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all"
              style={{
                width: `${Math.min(projectedPct, 100)}%`,
                backgroundColor: onTrack ? 'hsl(152 30% 75%)' : 'hsl(30 50% 80%)',
              }}
            />
            {/* Actual progress */}
            <div
              className="absolute inset-y-0 left-0 rounded-full transition-all"
              style={{
                width: `${Math.min((achieved / target) * 100, 100)}%`,
                background: accentColor
                  ? accentColor
                  : onTrack
                    ? 'linear-gradient(90deg, hsl(152 44% 38%), hsl(95 55% 48%))'
                    : 'linear-gradient(90deg, hsl(30 60% 50%), hsl(38 70% 55%))',
              }}
            />
            {/* Goal marker */}
            <div className="absolute inset-y-0 right-0 w-0.5 bg-foreground/20" />
          </div>
          <div className="flex items-center justify-between mt-1.5">
            <div className="flex items-center gap-3 text-[10px]">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: onTrack ? 'hsl(152 44% 38%)' : 'hsl(30 60% 50%)' }} />
                <span className="text-muted-foreground">Nu</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full" style={{ background: onTrack ? 'hsl(152 30% 75%)' : 'hsl(30 50% 80%)' }} />
                <span className="text-muted-foreground">Prognose 2030</span>
              </div>
            </div>
            <span className="text-[10px] font-medium text-muted-foreground tabular-nums">
              {formatDanishNumber(Math.round(currentRate), 1)} {unit}/dag
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
