import { Undo2 } from 'lucide-react';
import type { Delivery } from '@/types/delivery.types';
import { ballSymbol } from '@/utils/cricket';
import { cn } from '@/utils/cn';

interface Props {
  lastDelivery: Delivery | null;
  onUndo: () => void;
  disabled?: boolean;
}

export function UndoBar({ lastDelivery, onUndo, disabled }: Props) {
  if (!lastDelivery) return null;

  const symbol = ballSymbol(lastDelivery);
  const isWicket = !!lastDelivery.wicket;
  const label = isWicket
    ? `Undo OUT — ${lastDelivery.wicket!.type.replace(/_/g, ' ')}`
    : `Undo last: ${symbol}`;

  return (
    <div className="px-3 pt-1.5 pb-0.5">
      <button
        onClick={onUndo}
        disabled={disabled}
        className={cn(
          'w-full flex items-center justify-center gap-2',
          'py-1.5 rounded-xl border text-xs font-semibold transition-all active:scale-[0.98]',
          'disabled:opacity-40 disabled:cursor-not-allowed',
          isWicket
            ? 'bg-wicket/10 border-wicket/40 text-wicket hover:bg-wicket/20'
            : 'bg-pitch-light border-white/10 text-muted hover:border-gold/30 hover:text-white',
        )}
        aria-label="Undo last delivery"
      >
        <Undo2 size={13} className="shrink-0" />
        <span>{label}</span>
      </button>
    </div>
  );
}
