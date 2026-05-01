import { useFormContext } from 'react-hook-form';
import type { NewMatchForm } from '@/pages/SetupPage';
import { Button } from '@/components/common/Button';
import { cn } from '@/utils/cn';
import { autoMatchName } from '@/utils/format';

// ─── Stepper ──────────────────────────────────────────────────────────────────

interface StepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  presets?: number[];
  suffix?: string;
}

function Stepper({ value, min, max, onChange, presets, suffix = '' }: StepperProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center bg-pitch-dark border border-pitch-light rounded-2xl overflow-hidden">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          className="w-14 h-14 flex items-center justify-center text-2xl font-bold text-muted hover:text-white disabled:opacity-25 active:bg-pitch-light/50 transition-all shrink-0"
        >
          −
        </button>
        <div className="flex-1 flex items-center justify-center gap-1">
          <span className="font-display text-4xl text-white leading-none">{value}</span>
          {suffix && <span className="text-muted text-sm ml-1.5 mb-0.5">{suffix}</span>}
        </div>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-14 h-14 flex items-center justify-center text-2xl font-bold text-gold disabled:opacity-25 active:bg-gold/10 transition-all shrink-0"
        >
          +
        </button>
      </div>
      {presets && (
        <div className="flex gap-1.5">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onChange(p)}
              className={cn(
                'flex-1 py-1.5 rounded-lg text-xs font-bold border transition-all active:scale-95',
                value === p
                  ? 'bg-gold/20 border-gold/50 text-gold'
                  : 'bg-pitch-dark border-pitch-light text-muted hover:text-white hover:border-white/20',
              )}
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Ball type data ────────────────────────────────────────────────────────────

const BALL_TYPES = [
  { value: 'tennis',  label: 'Tennis',  emoji: '🎾', desc: 'Most common street' },
  { value: 'tape',    label: 'Tape',    emoji: '🔵', desc: 'Good swing & seam'  },
  { value: 'rubber',  label: 'Rubber',  emoji: '⚫', desc: 'Rubber core'        },
  { value: 'leather', label: 'Leather', emoji: '🔴', desc: 'Full match ball'    },
] as const;

// ─── Component ────────────────────────────────────────────────────────────────

interface Props { onNext: () => void; }

export function MatchConfigStep({ onNext }: Props) {
  const { register, watch, setValue, formState: { errors } } = useFormContext<NewMatchForm>();
  const isSinglePlayer = watch('config.isSinglePlayerMode');
  const overs = watch('config.overs');
  const playersPerSide = watch('config.playersPerSide');
  const ballType = watch('config.ballType');
  const nameValue = watch('name');

  return (
    <div className="space-y-5">
      {/* Match name */}
      <div>
        <label className="block text-sm font-semibold text-muted mb-1">Match Name (optional)</label>
        <input
          {...register('name')}
          placeholder="e.g. Sunday Gully Match"
          className="w-full bg-pitch-dark border border-pitch-light rounded-xl px-4 py-3 text-white placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-gold/50"
        />
        {!nameValue?.trim() && (
          <p className="text-muted/50 text-[11px] mt-1">
            Will save as &ldquo;{autoMatchName()}&rdquo;
          </p>
        )}
      </div>

      {/* Overs */}
      <div>
        <label className="block text-sm font-semibold text-muted mb-2">Overs</label>
        <Stepper
          value={overs}
          min={1}
          max={50}
          onChange={(v) => setValue('config.overs', v)}
          presets={[3, 5, 10, 20]}
          suffix="ov"
        />
        {errors.config?.overs && (
          <p className="text-wicket text-xs mt-1">Min 1 over</p>
        )}
      </div>

      {/* Players per side */}
      <div>
        <label className="block text-sm font-semibold text-muted mb-2">Players / Side</label>
        <Stepper
          value={playersPerSide}
          min={2}
          max={11}
          onChange={(v) => setValue('config.playersPerSide', v)}
          presets={[4, 6, 8, 11]}
        />
      </div>

      {/* Ball type — 2×2 card grid */}
      <div>
        <label className="block text-sm font-semibold text-muted mb-2">Ball Type</label>
        <div className="grid grid-cols-2 gap-2">
          {BALL_TYPES.map((bt) => {
            const selected = ballType === bt.value;
            return (
              <label
                key={bt.value}
                className={cn(
                  'flex items-center gap-3 rounded-xl py-3 px-4 border cursor-pointer transition-all',
                  selected
                    ? 'bg-gold/15 border-gold/60 shadow-[0_0_12px_0_rgb(var(--color-gold)/0.15)]'
                    : 'bg-pitch-dark border-pitch-light hover:border-white/20',
                )}
              >
                <input
                  {...register('config.ballType')}
                  type="radio"
                  value={bt.value}
                  className="sr-only"
                />
                <span className="text-xl select-none shrink-0">{bt.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className={cn('font-bold text-sm leading-tight', selected ? 'text-gold' : 'text-white')}>
                    {bt.label}
                  </p>
                  <p className="text-muted text-[10px] mt-0.5">{bt.desc}</p>
                </div>
                {selected && (
                  <div className="w-4 h-4 rounded-full bg-gold flex items-center justify-center shrink-0">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                      <path d="M1.5 4l2 2 3-3" stroke="#1a0e04" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
              </label>
            );
          })}
        </div>
      </div>

      {/* Single player mode */}
      <div className="border-t border-pitch-light pt-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-semibold text-white text-sm">Single Player Mode</p>
            <p className="text-xs text-muted">Skip player names — just tap scores</p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input {...register('config.isSinglePlayerMode')} type="checkbox" className="sr-only peer" />
            <div className="w-11 h-6 bg-pitch-dark rounded-full peer-checked:bg-gold transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
          </label>
        </div>
        {isSinglePlayer && (
          <div className="mt-2 bg-gold/10 border border-gold/20 rounded-xl px-3 py-2.5 text-xs text-gold/90 space-y-1.5">
            <p className="flex items-start gap-2"><span className="shrink-0">✓</span> No player name setup — teams are skipped</p>
            <p className="flex items-start gap-2"><span className="shrink-0">✓</span> Bowler panel replaced with a simple over counter</p>
            <p className="flex items-start gap-2"><span className="shrink-0">✓</span> Scorecard shows generic Player 1, 2… labels</p>
            <p className="flex items-start gap-2"><span className="shrink-0">✓</span> Great for casual solo tracking or practice sessions</p>
          </div>
        )}
      </div>

      <Button variant="gold" size="lg" fullWidth onClick={onNext}>
        Continue →
      </Button>
    </div>
  );
}
