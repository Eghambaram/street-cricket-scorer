import { useState } from 'react';
import { useFormContext } from 'react-hook-form';
import type { NewMatchForm } from '@/pages/SetupPage';
import { Button } from '@/components/common/Button';
import { cn } from '@/utils/cn';

interface Props { onNext: () => void; onBack: () => void; }

type CoinSide = 'heads' | 'tails';

export function TossStep({ onNext, onBack }: Props) {
  const { watch, setValue } = useFormContext<NewMatchForm>();
  const teams = watch('teams');
  const tossWinner = watch('toss.winnerTeamId');
  const tossChoice = watch('toss.choice');

  const [spinning, setSpinning] = useState(false);
  const [coinSide, setCoinSide] = useState<CoinSide | null>(null);
  const [spinKey, setSpinKey] = useState(0);

  const flipCoin = () => {
    if (spinning) return;
    setSpinning(true);
    setSpinKey((k) => k + 1);
    const result: CoinSide = Math.random() < 0.5 ? 'heads' : 'tails';
    setTimeout(() => {
      setCoinSide(result);
      setSpinning(false);
      // Heads = Team A wins, tails = Team B wins (still manually overridable below)
      setValue('toss.winnerTeamId', result === 'heads' ? teams[0].id : teams[1].id);
    }, 1050);
  };

  const canProceed = !!tossWinner && !!tossChoice;

  return (
    <div className="space-y-6">
      {/* Coin flip */}
      <div className="flex flex-col items-center gap-3 py-2">
        <p className="text-muted text-xs font-semibold uppercase tracking-wide">Tap coin to flip</p>

        <div
          className="relative cursor-pointer select-none"
          style={{ perspective: '600px' }}
          onClick={flipCoin}
        >
          <div
            key={spinKey}
            className={cn(
              'w-24 h-24 rounded-full flex items-center justify-center text-5xl shadow-glow',
              'border-4 transition-all',
              spinning && 'animate-coin-spin',
              !spinning && coinSide === 'heads'
                ? 'bg-gold/30 border-gold text-gold'
                : !spinning && coinSide === 'tails'
                ? 'bg-pitch-light border-muted text-white'
                : 'bg-pitch-light border-muted/40 text-muted',
            )}
            style={{ transformStyle: 'preserve-3d' }}
          >
            {spinning ? '🪙' : coinSide === 'heads' ? '🏏' : coinSide === 'tails' ? '🎯' : '🪙'}
          </div>
        </div>

        <div className="h-6 flex items-center">
          {coinSide && !spinning && (
            <p className={cn(
              'text-sm font-bold animate-fade-in',
              coinSide === 'heads' ? 'text-gold' : 'text-muted',
            )}>
              {coinSide === 'heads' ? 'Heads!' : 'Tails!'}
            </p>
          )}
        </div>

        <button
          onClick={flipCoin}
          disabled={spinning}
          className="text-xs font-semibold text-muted hover:text-gold transition-colors disabled:opacity-40 underline underline-offset-2"
        >
          {spinning ? 'Flipping…' : coinSide ? 'Flip again' : 'Tap coin to flip'}
        </button>
      </div>

      {/* Winner — auto-selected after flip, but still manually overridable */}
      <div>
        <p className="text-sm font-semibold text-muted mb-2">
          {coinSide ? 'Winner (auto-selected)' : 'Who won the toss?'}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {teams.map((team, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setValue('toss.winnerTeamId', team.id)}
              className={cn(
                'flex items-center justify-center rounded-xl py-4 border text-sm font-bold transition-all active:scale-95',
                tossWinner === team.id
                  ? 'bg-gold text-pitch-dark border-gold shadow-glow'
                  : 'bg-pitch-dark border-pitch-light text-white hover:border-gold/40',
              )}
            >
              {team.name || `Team ${i === 0 ? 'A' : 'B'}`}
            </button>
          ))}
        </div>
      </div>

      {/* Bat or bowl — only shown after a winner is chosen */}
      {tossWinner ? (
        <div>
          <p className="text-sm font-semibold text-muted mb-3">
            <span className="text-white font-bold">
              {teams.find((t) => t.id === tossWinner)?.name ?? '?'}
            </span>{' '}chose to…
          </p>
          <div className="grid grid-cols-2 gap-3">
            {(['bat', 'bowl'] as const).map((choice) => (
              <button
                key={choice}
                type="button"
                onClick={() => setValue('toss.choice', choice)}
                className={cn(
                  'flex flex-col items-center justify-center rounded-xl py-4 border transition-all active:scale-95',
                  tossChoice === choice
                    ? 'bg-gold text-pitch-dark border-gold shadow-glow'
                    : 'bg-pitch-dark border-pitch-light text-white hover:border-gold/40',
                )}
              >
                <span className="text-2xl mb-1">{choice === 'bat' ? '🏏' : '🎳'}</span>
                <span className="font-bold capitalize">{choice}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        <p className="text-center text-muted/50 text-xs py-2">Select the toss winner above first</p>
      )}

      {/* Premium "Ready to play" card — replaces old summary chip */}
      {canProceed && (() => {
        const winner = teams.find((t) => t.id === tossWinner);
        const batFirst = tossChoice === 'bat' ? winner : teams.find((t) => t.id !== tossWinner);
        const bowlFirst = tossChoice === 'bat' ? teams.find((t) => t.id !== tossWinner) : winner;
        return (
          <div className="relative overflow-hidden rounded-2xl bg-pitch-light border border-pitch-light/60 p-4 text-center animate-fade-in">
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
            <p className="text-muted text-[10px] font-bold uppercase tracking-widest mb-3">Ready to play</p>
            <div className="flex items-stretch justify-around gap-3">
              <div className="flex-1 flex flex-col items-center gap-1.5 bg-gold/10 border border-gold/25 rounded-xl py-3 px-2">
                <span className="text-2xl">🏏</span>
                <p className="text-white font-black text-sm leading-tight text-center truncate w-full px-1">
                  {batFirst?.name ?? '?'}
                </p>
                <span className="text-[9px] font-black text-gold uppercase tracking-widest">Batting First</span>
              </div>
              <div className="flex items-center text-muted/30 font-bold text-xl">VS</div>
              <div className="flex-1 flex flex-col items-center gap-1.5 bg-pitch-dark border border-pitch-light rounded-xl py-3 px-2">
                <span className="text-2xl">🎳</span>
                <p className="text-white font-black text-sm leading-tight text-center truncate w-full px-1">
                  {bowlFirst?.name ?? '?'}
                </p>
                <span className="text-[9px] font-black text-muted uppercase tracking-widest">Bowling First</span>
              </div>
            </div>
          </div>
        );
      })()}

      <div className="flex gap-3">
        <Button variant="secondary" size="lg" fullWidth onClick={onBack}>← Back</Button>
        <Button variant="gold" size="lg" fullWidth onClick={onNext} disabled={!canProceed}>
          Next: Start →
        </Button>
      </div>
    </div>
  );
}
