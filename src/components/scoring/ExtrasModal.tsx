import { useState } from 'react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { cn } from '@/utils/cn';
import type { DeliveryExtras } from '@/types/delivery.types';

interface Props {
  isOpen: boolean;
  type: 'wide' | 'no_ball' | 'bye' | 'leg_bye';
  onConfirm: (extras: DeliveryExtras, batsmanRuns: number) => void;
  onCancel: () => void;
}

const typeLabels = {
  wide:    'Wide',
  no_ball: 'No Ball',
  bye:     'Bye',
  leg_bye: 'Leg Bye',
};

const typeSubLabels = {
  wide:    'Extra runs beyond the +1 penalty',
  no_ball: 'Runs scored by batsman',
  bye:     'Runs scored as byes',
  leg_bye: 'Runs scored as leg byes',
};

// Quick-tap chip values per extra type
const quickChips: Record<Props['type'], number[]> = {
  wide:    [0, 1, 2, 3, 4],
  no_ball: [0, 1, 2, 4, 6],
  bye:     [1, 2, 3, 4],
  leg_bye: [1, 2, 3, 4],
};

export function ExtrasModal({ isOpen, type, onConfirm, onCancel }: Props) {
  // Byes/leg-byes minimum is 1 run
  const initialRuns = (type === 'bye' || type === 'leg_bye') ? 1 : 0;
  const [additionalRuns, setAdditionalRuns] = useState(initialRuns);

  const minRuns = (type === 'bye' || type === 'leg_bye') ? 1 : 0;

  const totalExtras = (() => {
    if (type === 'wide')    return 1 + additionalRuns;
    if (type === 'no_ball') return 1 + additionalRuns;
    return additionalRuns;
  })();

  const handleConfirm = () => {
    const extras: DeliveryExtras = { wide: 0, noBall: 0, bye: 0, legBye: 0 };
    let batsmanRuns = 0;

    if (type === 'wide') {
      extras.wide = 1 + additionalRuns;
    } else if (type === 'no_ball') {
      extras.noBall = 1;
      batsmanRuns = additionalRuns;
    } else if (type === 'bye') {
      extras.bye = additionalRuns;
    } else if (type === 'leg_bye') {
      extras.legBye = additionalRuns;
    }

    onConfirm(extras, batsmanRuns);
    setAdditionalRuns(initialRuns);
  };

  const chips = quickChips[type];

  return (
    <Modal isOpen={isOpen} title={typeLabels[type]} onClose={onCancel}>
      <p className="text-muted text-xs text-center mb-4 -mt-1">{typeSubLabels[type]}</p>

      {/* Quick chips — one-tap selection for common values */}
      <div className="flex gap-2 justify-center mb-5">
        {chips.map((val) => (
          <button
            key={val}
            onClick={() => setAdditionalRuns(val)}
            className={cn(
              'flex-1 py-3 rounded-xl border font-display text-2xl transition-all active:scale-95',
              additionalRuns === val
                ? 'bg-gold/20 border-gold text-gold shadow-[0_0_12px_0_rgba(240,192,64,0.3)]'
                : 'bg-pitch-dark border-pitch-light text-muted hover:border-white/30',
            )}
            aria-label={`${val} runs`}
          >
            {val}
          </button>
        ))}
      </div>

      {/* Fine-tune stepper for values outside chips */}
      <div className="flex items-center justify-center gap-6 mb-5">
        <button
          onClick={() => setAdditionalRuns((n) => Math.max(minRuns, n - 1))}
          className="w-11 h-11 rounded-full bg-pitch-dark border border-pitch-light text-white text-2xl font-bold flex items-center justify-center active:scale-95"
          aria-label="Decrease"
        >
          −
        </button>
        <span className="text-5xl font-black text-white w-16 text-center tabular-nums leading-none">
          {additionalRuns}
        </span>
        <button
          onClick={() => setAdditionalRuns((n) => n + 1)}
          className="w-11 h-11 rounded-full bg-pitch-dark border border-pitch-light text-white text-2xl font-bold flex items-center justify-center active:scale-95"
          aria-label="Increase"
        >
          +
        </button>
      </div>

      {/* Summary */}
      <div className="bg-pitch-dark rounded-xl p-3 mb-4 text-sm text-center">
        {type === 'no_ball' ? (
          <div className="flex items-center justify-center gap-4">
            <div>
              <span className="text-muted text-xs block">To extras</span>
              <span className="text-noball font-bold text-lg">1</span>
            </div>
            {additionalRuns > 0 && (
              <>
                <span className="text-muted/40">+</span>
                <div>
                  <span className="text-muted text-xs block">To batsman</span>
                  <span className="text-white font-bold text-lg">{additionalRuns}</span>
                </div>
              </>
            )}
            <div>
              <span className="text-muted text-xs block">Total runs</span>
              <span className="text-gold font-bold text-lg">{totalExtras}</span>
            </div>
          </div>
        ) : (
          <>
            <span className="text-muted">Total to extras: </span>
            <span className="text-white font-bold text-lg">{totalExtras}</span>
          </>
        )}
      </div>

      <div className="flex gap-3">
        <Button variant="secondary" fullWidth onClick={onCancel}>Cancel</Button>
        <Button variant="gold" fullWidth onClick={handleConfirm}>Record</Button>
      </div>
    </Modal>
  );
}
