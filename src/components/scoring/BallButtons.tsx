import { useState, useRef } from 'react';
import { cn } from '@/utils/cn';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';

interface Props {
  onRun: (runs: number) => void;
  onWicket: () => void;
  onWide: () => void;
  onNoBall: () => void;
  onBye: () => void;
  onLegBye: () => void;
  onToggleFreeHit: () => void;
  freeHitActive: boolean;
  disabled?: boolean;
}

const LONG_PRESS_MS = 600;

function haptic() { navigator.vibrate?.(30); }

export function BallButtons({ onRun, onWicket, onWide, onNoBall, onBye, onLegBye, onToggleFreeHit, freeHitActive, disabled }: Props) {
  const [showFive, setShowFive]       = useState(false);
  const [showPenalty, setShowPenalty] = useState(false);
  const [penaltyRuns, setPenaltyRuns] = useState(5);

  const timer     = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longFired = useRef(false);

  const clearTimer = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
  };

  // ── "4" button — short tap = 4 runs, hold 600 ms = show "5 runs" chip ──────
  const onFourDown = () => {
    if (disabled) return;
    longFired.current = false;
    timer.current = setTimeout(() => {
      longFired.current = true;
      setShowFive(true);
    }, LONG_PRESS_MS);
  };
  const onFourUp = () => {
    clearTimer();
    if (!longFired.current && !disabled) { haptic(); onRun(4); }
    longFired.current = false;
  };

  // ── "6" button — short tap = 6 runs, hold 600 ms = penalty-runs modal ──────
  const onSixDown = () => {
    if (disabled) return;
    longFired.current = false;
    timer.current = setTimeout(() => {
      longFired.current = true;
      setPenaltyRuns(5);
      setShowPenalty(true);
    }, LONG_PRESS_MS);
  };
  const onSixUp = () => {
    clearTimer();
    if (!longFired.current && !disabled) { haptic(); onRun(6); }
    longFired.current = false;
  };

  const cancelPress = () => { clearTimer(); longFired.current = false; };

  const baseBtn = cn(
    'flex items-center justify-center rounded-2xl select-none',
    'transition-all duration-100 active:scale-95',
    'min-h-[52px]',
    disabled && 'opacity-40 cursor-not-allowed',
  );

  return (
    <div className="px-3 py-1.5 space-y-1.5">
      {/* Backdrop that dismisses the "5 runs" chip when tapped outside */}
      {showFive && (
        <div className="fixed inset-0 z-10" onClick={() => setShowFive(false)} />
      )}

      {/* ── Runs grid ─────────────────────────────────────────────────────── */}
      {/* Row 1: 0 + 1 + 2 */}
      <div className="grid grid-cols-4 gap-2">
        {/* 0 — dot: spans 2 cols, most-pressed button */}
        <button
          onClick={() => { haptic(); if (!disabled) onRun(0); }}
          className={cn(
            baseBtn,
            'col-span-2 min-h-[56px]',
            'bg-pitch-light text-muted/60 border border-white/[0.10]',
            'font-display text-3xl',
            'shadow-[inset_0_1px_0_0_rgb(255_255_255/0.07)]',
          )}
          aria-label="0 runs"
        >
          ·
        </button>

        {/* 1 */}
        <button
          onClick={() => { haptic(); if (!disabled) onRun(1); }}
          className={cn(
            baseBtn,
            'bg-runs/10 text-runs font-display text-3xl',
            'border border-runs/30',
            'shadow-[inset_0_1px_0_0_rgb(var(--color-runs)/0.12)]',
          )}
          aria-label="1 run"
        >
          1
        </button>

        {/* 2 */}
        <button
          onClick={() => { haptic(); if (!disabled) onRun(2); }}
          className={cn(
            baseBtn,
            'bg-runs/10 text-runs font-display text-3xl',
            'border border-runs/30',
            'shadow-[inset_0_1px_0_0_rgb(var(--color-runs)/0.12)]',
          )}
          aria-label="2 runs"
        >
          2
        </button>
      </div>

      {/* Row 2: 3 + 4 + 6 */}
      <div className="grid grid-cols-3 gap-2">
        {/* 3 */}
        <button
          onClick={() => { haptic(); if (!disabled) onRun(3); }}
          className={cn(
            baseBtn,
            'bg-runs/10 text-runs font-display text-3xl',
            'border border-runs/30',
            'shadow-[inset_0_1px_0_0_rgb(var(--color-runs)/0.12)]',
          )}
          aria-label="3 runs"
        >
          3
        </button>

        {/* 4: short-tap = 4 runs | hold 600 ms = "5 runs" chip floats above */}
        <div className="relative z-20">
          {showFive && (
            <button
              className={cn(
                'absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20',
                'whitespace-nowrap bg-gold text-pitch-dark font-black text-lg',
                'rounded-xl px-4 min-h-[56px] shadow-lg animate-fade-in',
                'flex items-center justify-center',
              )}
              onClick={() => { setShowFive(false); !disabled && onRun(5); }}
              aria-label="5 runs"
            >
              5 runs
            </button>
          )}
          <button
            onPointerDown={onFourDown}
            onPointerUp={onFourUp}
            onPointerLeave={cancelPress}
            onPointerCancel={cancelPress}
            onContextMenu={(e) => e.preventDefault()}
            className={cn(
              baseBtn,
              'w-full touch-none flex-col gap-0',
              'bg-btn-four text-four font-display text-5xl',
              'border-2 border-four/40',
              'shadow-[0_0_18px_0_rgb(var(--color-four)/0.25),inset_0_1px_0_0_rgb(var(--color-four)/0.2)]',
            )}
            aria-label="4 runs — hold for 5"
          >
            <span className="font-display text-5xl leading-none">4</span>
            <span className="font-sans text-[9px] font-semibold text-four/50 leading-none -mt-1">hold→5</span>
          </button>
        </div>

        {/* 6: short-tap = 6 runs | hold 600 ms = penalty-runs modal */}
        <div className="relative">
          <button
            onPointerDown={onSixDown}
            onPointerUp={onSixUp}
            onPointerLeave={cancelPress}
            onPointerCancel={cancelPress}
            onContextMenu={(e) => e.preventDefault()}
            className={cn(
              baseBtn,
              'w-full touch-none',
              'bg-btn-six text-six font-display text-5xl',
              'border-2 border-six/50',
              'shadow-[0_0_22px_0_rgb(var(--color-six)/0.35),inset_0_1px_0_0_rgb(var(--color-six)/0.2)]',
            )}
            aria-label="6 runs — hold for penalty"
          >
            6
          </button>
        </div>
      </div>

      {/* ── Extras row (4 cols: Wide, NoBall, Bye, LegBye) ──────────────── */}
      <div className="grid grid-cols-4 gap-2">
        <button
          onClick={() => { haptic(); if (!disabled) onWide(); }}
          className={cn(
            baseBtn,
            'flex-col gap-0',
            'bg-wide/[0.08] border border-wide/40 text-wide',
            'text-sm font-bold',
          )}
          aria-label="Wide"
        >
          <span>Wd</span>
          <span className="text-[9px] font-semibold text-wide/50 leading-none">+runs</span>
        </button>

        <button
          onClick={() => { haptic(); if (!disabled) onNoBall(); }}
          className={cn(
            baseBtn,
            'flex-col gap-0',
            'bg-noball/[0.08] border border-noball/40 text-noball',
            'text-sm font-bold',
          )}
          aria-label="No Ball"
        >
          <span>NB</span>
          <span className="text-[9px] font-semibold text-noball/50 leading-none">+runs</span>
        </button>

        <button
          onClick={() => { haptic(); if (!disabled) onBye(); }}
          className={cn(
            baseBtn,
            'flex-col gap-0',
            'bg-pitch-light border border-white/[0.08] text-muted',
            'text-sm font-bold',
          )}
          aria-label="Bye"
        >
          <span>Bye</span>
          <span className="text-[9px] font-semibold text-muted/40 leading-none">+runs</span>
        </button>

        <button
          onClick={() => { haptic(); if (!disabled) onLegBye(); }}
          className={cn(
            baseBtn,
            'flex-col gap-0',
            'bg-pitch-light border border-white/[0.08] text-muted',
            'text-sm font-bold',
          )}
          aria-label="Leg Bye"
        >
          <span>LB</span>
          <span className="text-[9px] font-semibold text-muted/40 leading-none">+runs</span>
        </button>
      </div>

      {/* ── Free Hit toggle + Wicket (side-by-side) ─────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {/* Free Hit toggle — col-span-1 */}
        <button
          onClick={() => { haptic(); if (!disabled) onToggleFreeHit(); }}
          className={cn(
            baseBtn,
            'flex-col gap-0.5 relative overflow-hidden',
            freeHitActive
              ? [
                  'bg-safe/[0.18] border-2 border-safe text-safe',
                  'shadow-[0_0_18px_0_rgb(var(--color-safe)/0.45),inset_0_1px_0_0_rgb(var(--color-safe)/0.2)]',
                ]
              : [
                  'bg-safe/[0.06] border border-safe/30 text-safe/60',
                ],
          )}
          aria-label={freeHitActive ? 'Free Hit active — tap to cancel' : 'Grant free hit'}
        >
          {freeHitActive && (
            <span className="absolute inset-0 rounded-2xl animate-ping bg-safe/10 pointer-events-none" />
          )}
          <span className="text-[11px] font-black tracking-wide leading-none z-10 relative">
            {freeHitActive ? '🛡️ FREE' : '🛡️'}
          </span>
          <span className={cn(
            'text-[8px] font-bold leading-none z-10 relative',
            freeHitActive ? 'text-safe' : 'text-safe/40',
          )}>
            {freeHitActive ? 'HIT ON' : 'HIT'}
          </span>
        </button>

        {/* Wicket — col-span-2 */}
        <button
          onClick={() => { haptic(); if (!disabled) onWicket(); }}
          className={cn(
            'col-span-2 min-h-[52px] rounded-2xl',
            'bg-wicket/[0.12] text-wicket',
            'border-2 border-wicket/50',
            'font-display text-3xl tracking-[3px]',
            'flex items-center justify-center gap-3',
            'shadow-[0_0_20px_0_rgb(var(--color-wicket)/0.25),inset_0_1px_0_0_rgb(var(--color-wicket)/0.2)]',
            'active:scale-[0.97] transition-all duration-100',
            disabled && 'opacity-40 cursor-not-allowed',
          )}
          disabled={!!disabled}
          aria-label="Wicket"
        >
          WICKET
        </button>
      </div>

      {/* ── Penalty runs modal (long-press on 6) ────────────────────────── */}
      <Modal isOpen={showPenalty} title="Penalty Runs" onClose={() => setShowPenalty(false)}>
        <p className="text-muted text-sm text-center mb-5">
          Typically 5 penalty runs for a fielding violation
        </p>
        <div className="flex items-center justify-center gap-6 mb-6">
          <button
            onClick={() => setPenaltyRuns((n) => Math.max(1, n - 1))}
            className="w-12 h-12 rounded-full bg-pitch-dark border border-pitch-light text-white text-2xl font-bold flex items-center justify-center active:scale-95"
            aria-label="Decrease"
          >
            −
          </button>
          <span className="text-5xl font-black text-white w-16 text-center tabular-nums">
            {penaltyRuns}
          </span>
          <button
            onClick={() => setPenaltyRuns((n) => n + 1)}
            className="w-12 h-12 rounded-full bg-pitch-dark border border-pitch-light text-white text-2xl font-bold flex items-center justify-center active:scale-95"
            aria-label="Increase"
          >
            +
          </button>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => setShowPenalty(false)}>
            Cancel
          </Button>
          <Button
            variant="gold"
            fullWidth
            onClick={() => { setShowPenalty(false); onRun(penaltyRuns); }}
          >
            Add {penaltyRuns} runs
          </Button>
        </div>
      </Modal>
    </div>
  );
}
