import { useFormContext } from 'react-hook-form';
import type { NewMatchForm } from '@/pages/SetupPage';
import { Button } from '@/components/common/Button';
import { cn } from '@/utils/cn';
import type { FreeHitMode } from '@/types/rules.types';

const ruleItems = [
  { key: 'lastManStands',       label: 'Last Man Stands',      desc: 'Final batsman can bat alone' },
  { key: 'oneTipOneHand',       label: 'One Tip One Hand',     desc: 'One bounce + one hand catch = out' },
  { key: 'noLBW',               label: 'No LBW',               desc: 'LBW dismissals not applicable' },
  { key: 'noByes',              label: 'No Byes',              desc: 'Byes not counted as extras' },
  { key: 'retiredHurtAllowed',  label: 'Retired Hurt Allowed', desc: 'Batsman can retire and return' },
] as const;

const FREE_HIT_OPTIONS: { value: FreeHitMode; label: string; desc: string }[] = [
  { value: 'none',                   label: 'Off',          desc: 'Manual only' },
  { value: 'per_noball',             label: 'Per No Ball',  desc: 'After every no-ball' },
  { value: 'two_consecutive_extras', label: '2 in a Row',   desc: 'After 2 wides/no-balls' },
];

interface Props { onNext: () => void; onBack: () => void; }

export function RulesStep({ onNext, onBack }: Props) {
  const { register, watch, setValue } = useFormContext<NewMatchForm>();
  const maxOvers = watch('rules.maxOversPerBowler');
  const freeHitMode = (watch('rules.freeHitMode') ?? 'none') as FreeHitMode;

  return (
    <div className="space-y-2">
      {ruleItems.map(({ key, label, desc }) => (
        <label key={key} className="flex items-center justify-between py-3 border-b border-pitch-light cursor-pointer">
          <div>
            <p className="font-semibold text-white text-sm">{label}</p>
            <p className="text-xs text-muted">{desc}</p>
          </div>
          <div className="relative inline-flex items-center cursor-pointer ml-3 shrink-0">
            <input
              {...register(`rules.${key}`)}
              type="checkbox"
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-pitch-dark rounded-full peer-checked:bg-gold transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
          </div>
        </label>
      ))}

      {/* Free Hit Rule — 3-way selector */}
      <div className="py-3 border-b border-pitch-light">
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="font-semibold text-white text-sm">🛡️ Free Hit Rule</p>
            <p className="text-xs text-muted">When to auto-grant a free hit</p>
          </div>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-safe/15 text-safe border border-safe/30">
            {FREE_HIT_OPTIONS.find((o) => o.value === freeHitMode)?.label ?? 'Off'}
          </span>
        </div>
        <div className="flex gap-1.5 mb-1.5">
          {FREE_HIT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => setValue('rules.freeHitMode', opt.value)}
              className={cn(
                'flex-1 py-2 px-1 rounded-xl border text-center transition-all',
                freeHitMode === opt.value
                  ? 'bg-safe/15 border-safe/50 text-safe'
                  : 'bg-pitch-dark border-pitch-light/40 text-muted',
              )}
            >
              <p className="text-[11px] font-black leading-tight">{opt.label}</p>
              <p className="text-[9px] leading-tight mt-0.5 opacity-70">{opt.desc}</p>
            </button>
          ))}
        </div>
        <p className="text-[10px] text-muted/60 leading-relaxed">
          Scorer can always grant a free hit manually with the 🛡️ button during play.
        </p>
      </div>

      <div className="py-3 border-b border-pitch-light">
        <div className="flex items-center justify-between mb-1">
          <p className="font-semibold text-white text-sm">Max Overs / Bowler</p>
          <span className="text-gold font-bold">{maxOvers === 0 ? 'Unlimited' : maxOvers}</span>
        </div>
        <input
          {...register('rules.maxOversPerBowler', { valueAsNumber: true })}
          type="range"
          min={0}
          max={10}
          step={1}
          className="w-full accent-gold"
        />
        <p className="text-xs text-muted mt-1">0 = no restriction</p>
      </div>

      <div className="flex gap-3 pt-4">
        <Button variant="secondary" size="lg" fullWidth onClick={onBack}>← Back</Button>
        <Button variant="gold" size="lg" fullWidth onClick={onNext}>
          Review & Start →
        </Button>
      </div>
    </div>
  );
}
