import { Undo2 } from 'lucide-react';
import type { Delivery } from '@/types/delivery.types';
import { ballBadgeClass, ballSymbol } from '@/utils/cricket';
import { cn } from '@/utils/cn';

interface Props {
  lastDelivery: Delivery | null;
  onUndo: () => void;
  disabled?: boolean;
  /** Shown when this innings has no balls but undo can still step back (into the 1st innings). */
  fallbackLabel?: string;
}

export function UndoBar({ lastDelivery, onUndo, disabled, fallbackLabel }: Props) {
  if (!lastDelivery && !fallbackLabel) return null;

  const isWicket = !!lastDelivery?.wicket;
  const detail = isWicket ? `OUT — ${lastDelivery!.wicket!.type.replace(/_/g, ' ')}` : 'last ball';
  const ariaLabel = !lastDelivery
    ? fallbackLabel
    : `Undo ${isWicket ? detail : `last ball: ${ballSymbol(lastDelivery)}`}`;

  return (
    <div className="px-3 pt-1.5 pb-0.5">
      {/* 48px tall, gold outline: clearly a button, but quieter than the ball pads below */}
      <button
        onClick={onUndo}
        disabled={disabled}
        className={cn(
          'w-full min-h-[48px] flex items-center gap-3 px-4',
          'rounded-xl border-2 text-sm font-bold transition-all active:scale-[0.98]',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          lastDelivery ? 'justify-between' : 'justify-center',
          isWicket
            ? 'bg-wicket/10 border-wicket/50 text-wicket hover:bg-wicket/20'
            : 'bg-gold/10 border-gold/50 text-gold hover:bg-gold/20',
        )}
        aria-label={ariaLabel}
      >
        <span className="flex items-center gap-2 shrink-0">
          <Undo2 size={18} strokeWidth={2.5} className="shrink-0" />
          <span>{lastDelivery ? 'Undo' : fallbackLabel}</span>
        </span>

        {/* Last ball chip — same colours as the over tracker, so it's recognisable */}
        {lastDelivery && (
          <span className="flex items-center gap-2 min-w-0">
            <span className="text-xs font-semibold opacity-80 truncate capitalize">{detail}</span>
            <span
              className={cn(
                'inline-flex items-center justify-center rounded-lg min-w-[32px] h-8 px-1.5 text-sm font-bold shrink-0',
                ballBadgeClass(lastDelivery),
              )}
            >
              {ballSymbol(lastDelivery)}
            </span>
          </span>
        )}
      </button>
    </div>
  );
}
