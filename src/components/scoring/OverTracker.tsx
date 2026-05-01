import { useState, useRef, useEffect } from 'react';
import type { Delivery } from '@/types/delivery.types';
import { ballSymbol, ballBadgeClass, isLegalDelivery } from '@/utils/cricket';

interface Props {
  deliveries: Delivery[];
  currentOverIndex: number;
}

export function OverTracker({ deliveries, currentOverIndex }: Props) {
  const [showMaiden, setShowMaiden] = useState(false);
  const prevOverIndex = useRef(currentOverIndex);

  // Current-over data (resets naturally when currentOverIndex increases — no deliveries yet for new over)
  const currentOverDeliveries = deliveries.filter((d) => d.overIndex === currentOverIndex);

  // Detect over boundary: advance = check maiden, retreat (undo) = clear flash
  useEffect(() => {
    const prev = prevOverIndex.current;
    prevOverIndex.current = currentOverIndex;

    if (currentOverIndex === prev + 1) {
      // The 6th legal ball was just bowled — check if the completed over was a maiden
      const completedDels = deliveries.filter((d) => d.overIndex === currentOverIndex - 1);
      const legalCount    = completedDels.filter(isLegalDelivery).length;
      // Runs charged to the bowler (wides and no-balls count, byes/leg-byes do not)
      const runsCharged   = completedDels.reduce(
        (s, d) => s + d.runs + d.extras.wide + d.extras.noBall,
        0,
      );
      if (legalCount === 6 && runsCharged === 0) {
        setShowMaiden(true);
      }
    } else if (currentOverIndex < prev) {
      // Undo past an over boundary — dismiss any active maiden flash immediately
      setShowMaiden(false);
    }
  }, [currentOverIndex, deliveries]);

  // Dismiss maiden badge when the first ball of the new over is bowled
  useEffect(() => {
    if (!showMaiden) return;
    if (currentOverDeliveries.length > 0) setShowMaiden(false);
  }, [showMaiden, currentOverDeliveries.length]);
  const overRuns    = currentOverDeliveries.reduce(
    (s, d) => s + d.runs + d.extras.wide + d.extras.noBall + d.extras.bye + d.extras.legBye,
    0,
  );
  const overWickets = currentOverDeliveries.filter((d) => d.wicket).length;
  const emptySlots  = Math.max(0, 6 - currentOverDeliveries.filter(isLegalDelivery).length);

  return (
    <div className="px-3 py-2 bg-pitch-dark border-t border-pitch/60">
      {/* Header row: over label | maiden flash | over runs */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs font-bold text-white">
          Over {currentOverIndex + 1}
        </span>

        {showMaiden && (
          <span className="text-sm font-black text-gold tracking-widest animate-score-pulse">
            ✦ MAIDEN!
          </span>
        )}

        <span className="text-xs text-muted font-semibold">
          {overRuns}
          {overWickets > 0 && <span className="text-wicket"> · {overWickets}W</span>}
        </span>
      </div>

      {/* Ball badges + empty-slot indicators — horizontal scroll for wide balls */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 no-scrollbar">
        {currentOverDeliveries.map((d) => (
          <span
            key={d.id}
            className={`inline-flex items-center justify-center rounded-lg min-w-[36px] h-9 text-sm font-bold px-1.5 shrink-0 ${ballBadgeClass(d)}`}
          >
            {ballSymbol(d)}
          </span>
        ))}
        {Array.from({ length: emptySlots }).map((_, i) => (
          <span
            key={`empty-${i}`}
            className="inline-flex items-center justify-center rounded-lg min-w-[36px] h-9 border border-dashed border-pitch-light/50 text-muted/40 text-sm shrink-0"
          >
            ·
          </span>
        ))}
      </div>
    </div>
  );
}
