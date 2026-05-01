import { useState, useEffect } from 'react';
import { Users, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { cn } from '@/utils/cn';
import { econColor, formatScore, formatOversShort } from '@/utils/format';
import { bowlerOversDisplay } from '@/utils/cricket';
import type { Match, Innings } from '@/types/match.types';
import type { InningsStats } from '@/types/delivery.types';

interface Props {
  isOpen: boolean;
  match: Match;
  completedInnings: Innings;
  inn1Stats: InningsStats;
  onStart: (params: { striker: string; nonStriker: string; bowler: string }) => void;
}

type Step = 'openers' | 'bowler';

function PickButton({
  name,
  sub,
  selected,
  disabled,
  onClick,
}: {
  name: string;
  sub?: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all active:scale-[0.98]',
        selected && 'bg-gold/15 border-gold',
        !selected && !disabled && 'bg-pitch-dark border-pitch-light hover:border-white/30',
        disabled && 'bg-pitch-dark border-pitch-dark opacity-30 cursor-not-allowed',
      )}
    >
      <span className={cn('font-semibold text-sm', selected ? 'text-gold' : 'text-white')}>
        {name}
      </span>
      <div className="flex items-center gap-2">
        {sub && <span className="text-xs text-muted font-mono">{sub}</span>}
        {selected && <CheckCircle2 size={15} className="text-gold" />}
      </div>
    </button>
  );
}

// Step indicator dots
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-4">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'rounded-full transition-all',
            i < current  && 'w-2 h-2 bg-gold',
            i === current && 'w-4 h-2 bg-gold',
            i > current  && 'w-2 h-2 bg-pitch-light',
          )}
        />
      ))}
    </div>
  );
}

export function InningsBreakModal({ isOpen, match, completedInnings, inn1Stats, onStart }: Props) {
  const [step, setStep] = useState<Step>('openers');
  const [striker, setStriker] = useState('');
  const [nonStriker, setNonStriker] = useState('');
  const [bowler, setBowler] = useState('');
  const [starting, setStarting] = useState(false);

  // Reset on open
  useEffect(() => {
    if (!isOpen) return;
    setStep('openers');
    setStriker('');
    setNonStriker('');
    setBowler('');
    setStarting(false);
  }, [isOpen]);

  const battingTeamForInn2Id =
    completedInnings.battingTeamId === match.teams[0].id
      ? match.teams[1].id
      : match.teams[0].id;
  const bowlingTeamForInn2Id = completedInnings.battingTeamId;

  const battingTeam = match.teams.find((t) => t.id === battingTeamForInn2Id);
  const bowlingTeam = match.teams.find((t) => t.id === bowlingTeamForInn2Id);
  const target = inn1Stats.totalRuns + 1;

  const strikerName = battingTeam?.players.find((p) => p.id === striker)?.name;
  const nonStrikerName = battingTeam?.players.find((p) => p.id === nonStriker)?.name;
  const bowlerName = bowlingTeam?.players.find((p) => p.id === bowler)?.name;

  const canAdvanceToStep2 = !!striker && !!nonStriker && striker !== nonStriker;
  const canStart = canAdvanceToStep2 && !!bowler;

  const handleStart = async () => {
    if (!canStart || starting) return;
    setStarting(true);
    await onStart({ striker, nonStriker, bowler });
    setStarting(false);
  };

  const inn1BowlerOptions = (bowlingTeam?.players ?? []).map((p) => {
    const sc = inn1Stats.bowlerScores[p.id];
    const figures = sc && sc.legalBalls > 0
      ? `${bowlerOversDisplay(sc.legalBalls)}-${sc.maidens}-${sc.runs}-${sc.wickets}`
      : '—';
    const econ = sc && sc.legalBalls > 0 ? sc.economy : null;
    return { ...p, sc, figures, econ };
  });

  return (
    <Modal isOpen={isOpen} title="Innings Break" persistent>

      {/* 1st innings summary banner */}
      <div className="bg-pitch-dark rounded-2xl p-4 mb-5 text-center">
        <p className="text-muted text-xs font-semibold uppercase tracking-wide mb-1">1st Innings</p>
        <p className="text-base font-black text-white">
          {match.teams.find((t) => t.id === completedInnings.battingTeamId)?.name}
        </p>
        <p className="text-4xl font-black text-gold mt-1 leading-none">
          {formatScore(inn1Stats.totalRuns, inn1Stats.wickets)}
        </p>
        <p className="text-muted text-xs mt-1">in {formatOversShort(inn1Stats.legalBalls)} overs</p>
        <div className="mt-3 pt-3 border-t border-pitch-light/30">
          <p className="text-white font-bold text-sm">
            {battingTeam?.name} need{' '}
            <span className="text-gold">{target}</span> to win
          </p>
          <p className="text-muted text-xs mt-0.5">off {match.config.overs * 6} balls</p>
        </div>
      </div>

      <StepDots current={step === 'openers' ? 0 : 1} total={2} />

      {/* ── STEP 1: Openers ── */}
      {step === 'openers' && (
        <>
          <p className="text-muted text-xs font-semibold uppercase tracking-wide text-center mb-3">
            {battingTeam?.name} — Opening Pair
          </p>

          {/* Visual pairing card */}
          {(striker || nonStriker) && (
            <div className="flex items-center gap-2 bg-gold/10 border border-gold/25 rounded-xl px-4 py-3 mb-3">
              <Users size={14} className="text-gold shrink-0" />
              <div className="flex-1 flex items-center gap-1.5 text-sm font-semibold">
                <span className={striker ? 'text-gold' : 'text-muted/40'}>
                  {strikerName ?? '— facing —'}
                </span>
                <span className="text-muted/40 text-xs">vs</span>
                <span className={nonStriker ? 'text-gold' : 'text-muted/40'}>
                  {nonStrikerName ?? '— non-striker —'}
                </span>
              </div>
              {striker && (
                <span className="text-[9px] font-black bg-gold/20 text-gold border border-gold/30 rounded px-1 leading-none uppercase tracking-wide shrink-0">
                  faces
                </span>
              )}
            </div>
          )}

          <div className="mb-2">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
              Facing first (Striker)
            </p>
            <div className="space-y-1.5">
              {battingTeam?.players.map((p) => (
                <PickButton
                  key={p.id}
                  name={p.name}
                  selected={striker === p.id}
                  disabled={nonStriker === p.id}
                  onClick={() => setStriker(p.id)}
                />
              ))}
            </div>
          </div>

          <div className="mb-5">
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
              Non-Striker
            </p>
            <div className="space-y-1.5">
              {battingTeam?.players.map((p) => (
                <PickButton
                  key={p.id}
                  name={p.name}
                  selected={nonStriker === p.id}
                  disabled={striker === p.id}
                  onClick={() => setNonStriker(p.id)}
                />
              ))}
            </div>
          </div>

          <Button
            variant="gold"
            size="lg"
            fullWidth
            disabled={!canAdvanceToStep2}
            onClick={() => setStep('bowler')}
          >
            Next: Opening Bowler →
          </Button>
        </>
      )}

      {/* ── STEP 2: Opening Bowler ── */}
      {step === 'bowler' && (
        <>
          {/* Summary chip */}
          {(strikerName || nonStrikerName) && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {strikerName && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gold/10 border border-gold/25 text-gold text-xs font-bold">
                  {strikerName} ●
                </span>
              )}
              {nonStrikerName && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gold/10 border border-gold/25 text-gold text-xs font-bold">
                  {nonStrikerName}
                </span>
              )}
              {bowlerName && (
                <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gold/10 border border-gold/25 text-gold text-xs font-bold">
                  {bowlerName} bowling
                </span>
              )}
            </div>
          )}

          <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
            Opening Bowler
          </p>

          {/* Bowler list with 1st innings figures */}
          <div className="space-y-1.5 mb-5">
            {inn1BowlerOptions.map((b) => {
              const isSelected = bowler === b.id;
              return (
                <button
                  key={b.id}
                  onClick={() => setBowler(b.id)}
                  className={cn(
                    'w-full flex items-center gap-3 rounded-xl px-4 py-3 border transition-all active:scale-[0.98] text-left',
                    isSelected
                      ? 'bg-gold/15 border-gold'
                      : 'bg-pitch-dark border-pitch-light hover:border-white/30',
                  )}
                >
                  <span className={cn('flex-1 font-semibold text-sm', isSelected ? 'text-gold' : 'text-white')}>
                    {b.name}
                  </span>
                  <span className={cn('text-xs font-mono shrink-0', isSelected ? 'text-gold/80' : 'text-muted')}>
                    {b.figures}
                  </span>
                  {b.econ !== null && (
                    <span className={cn('text-xs font-bold font-mono w-14 text-right shrink-0', econColor(b.econ))}>
                      {b.econ.toFixed(1)} econ
                    </span>
                  )}
                  {isSelected && <CheckCircle2 size={16} className="text-gold shrink-0" />}
                </button>
              );
            })}
          </div>

          {/* Low-bowler-count warning */}
          {inn1BowlerOptions.length <= 2 && (
            <div className="flex items-start gap-2 bg-gold/10 border border-gold/30 rounded-xl px-3 py-2.5 mb-3">
              <AlertTriangle size={14} className="text-gold shrink-0 mt-0.5" />
              <p className="text-gold text-xs font-semibold">
                Only {inn1BowlerOptions.length} bowler{inn1BowlerOptions.length === 1 ? '' : 's'} available
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setStep('openers')}>
              ← Back
            </Button>
            <Button
              variant="gold"
              size="lg"
              fullWidth
              disabled={!canStart || starting}
              loading={starting}
              onClick={handleStart}
            >
              Start 2nd Innings 🏏
            </Button>
          </div>
        </>
      )}
    </Modal>
  );
}
