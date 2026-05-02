import { useState, useEffect } from 'react';
import { AlertTriangle, CheckCircle2, UserPlus } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { cn } from '@/utils/cn';
import type { Innings, Match } from '@/types/match.types';
import type { InningsStats } from '@/types/delivery.types';
import { bowlerOversDisplay } from '@/utils/cricket';
import { econColor } from '@/utils/format';

interface Props {
  isOpen: boolean;
  match: Match;
  innings: Innings;
  stats: InningsStats;
  completedOverRuns: number;
  completedOverWickets: number;
  onSelect: (bowlerId: string) => void;
  onAddBowler: (name: string) => Promise<void> | void;
}

export function NewOverModal({
  isOpen,
  match,
  innings,
  stats,
  completedOverRuns,
  completedOverWickets,
  onSelect,
  onAddBowler,
}: Props) {
  const [selected, setSelected] = useState('');
  const [newBowlerName, setNewBowlerName] = useState('');
  const bowlingTeam = match.teams.find((t) => t.id === innings.bowlingTeamId);
  const maxOvers = match.rules.maxOversPerBowler;

  const bowlerOptions = (bowlingTeam?.players ?? []).map((p) => {
    const sc = stats.bowlerScores[p.id];
    const completedOvers = sc ? Math.floor(sc.legalBalls / 6) : 0;
    const isLastBowler = p.id === innings.currentBowlerId;
    const reachedMax = maxOvers > 0 && completedOvers >= maxOvers;
    const canBowl = !isLastBowler && !reachedMax;
    const disabledReason = isLastBowler
      ? 'consecutive'
      : reachedMax
      ? `max ${maxOvers} ov`
      : null;
    return { ...p, sc, legalBalls: sc?.legalBalls ?? 0, completedOvers, isLastBowler, reachedMax, canBowl, disabledReason };
  });

  const eligible = bowlerOptions.filter((b) => b.canBowl);
  const ineligible = bowlerOptions.filter((b) => !b.canBowl);
  const eligibleCount = eligible.length;
  const showCapWarning = maxOvers > 0 && eligibleCount === 1;

  const completedOverIndex = stats.overs;
  const isOpeningBowler = completedOverIndex === 0 && innings.currentBowlerId === null;

  const modalTitle = isOpeningBowler
    ? 'Select Opening Bowler'
    : `Over ${completedOverIndex} — ${completedOverRuns}R${completedOverWickets > 0 ? ` ${completedOverWickets}W` : ''}`;

  // Auto-select sole eligible bowler
  useEffect(() => {
    if (!isOpen) { setSelected(''); return; }
    if (eligible.length === 1) {
      setSelected(eligible[0].id);
    } else {
      setSelected('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const figuresLabel = (b: typeof bowlerOptions[0]) => {
    if (!b.sc || b.legalBalls === 0) return '—';
    return `${bowlerOversDisplay(b.legalBalls)}-${b.sc.maidens}-${b.sc.runs}-${b.sc.wickets}`;
  };

  return (
    <Modal isOpen={isOpen} title={modalTitle} persistent>
      {!isOpeningBowler && (
        <p className="text-muted text-sm text-center mb-4">Select bowler for Over {completedOverIndex + 1}</p>
      )}
      {isOpeningBowler && (
        <p className="text-muted text-sm text-center mb-4">Who will bowl the first over?</p>
      )}


      <div className="mb-3 rounded-xl border border-pitch-light bg-pitch-dark p-3">
        <p className="text-xs text-muted mb-2">New player joined? Add bowler</p>
        <div className="flex gap-2">
          <input
            value={newBowlerName}
            onChange={(e) => setNewBowlerName(e.target.value)}
            placeholder="New bowler name"
            className="flex-1 bg-pitch border border-pitch-light rounded-lg px-3 py-2 text-sm text-white"
          />
          <button
            onClick={async () => { if (!newBowlerName.trim()) return; await onAddBowler(newBowlerName.trim()); setNewBowlerName(''); }}
            className="px-3 py-2 rounded-lg bg-gold/20 border border-gold/40 text-gold text-xs font-bold flex items-center gap-1"
          >
            <UserPlus size={13} /> Add
          </button>
        </div>
      </div>

      {showCapWarning && (
        <div className="flex items-start gap-2 bg-gold/10 border border-gold/30 rounded-xl px-3 py-2.5 mb-3">
          <AlertTriangle size={15} className="text-gold flex-shrink-0 mt-0.5" />
          <p className="text-gold text-xs font-semibold">
            Only 1 bowler eligible — all others have reached the {maxOvers}-over cap
          </p>
        </div>
      )}

      {/* Eligible bowlers */}
      <div className="space-y-2 mb-3">
        {eligible.map((b) => {
          const isSelected = selected === b.id;
          const econ = b.sc && b.legalBalls > 0 ? b.sc.economy : null;
          return (
            <button
              key={b.id}
              onClick={() => setSelected(b.id)}
              className={cn(
                'w-full flex items-center gap-3 rounded-xl px-4 py-3 border transition-all active:scale-[0.98]',
                isSelected
                  ? 'bg-gold/15 border-gold'
                  : 'bg-pitch-dark border-pitch-light hover:border-white/30',
              )}
            >
              {/* Name */}
              <span className={cn('flex-1 font-semibold text-sm text-left', isSelected ? 'text-gold' : 'text-white')}>
                {b.name}
              </span>

              {/* Figures */}
              <span className={cn('text-xs font-mono', isSelected ? 'text-gold/80' : 'text-muted')}>
                {figuresLabel(b)}
              </span>

              {/* Economy badge */}
              {econ !== null && (
                <span className={cn('text-xs font-bold font-mono w-14 text-right', econColor(econ))}>
                  {econ.toFixed(1)} econ
                </span>
              )}

              {/* Over cap progress */}
              {maxOvers > 0 && (
                <span className="text-xs text-muted font-mono w-10 text-right shrink-0">
                  {b.completedOvers}/{maxOvers}
                </span>
              )}

              {isSelected && <CheckCircle2 size={16} className="text-gold shrink-0" />}
            </button>
          );
        })}
      </div>

      {/* Ineligible bowlers — dimmed with reason tag */}
      {ineligible.length > 0 && (
        <div className="space-y-1.5 mb-4">
          {ineligible.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-3 rounded-xl px-4 py-2.5 border border-pitch-dark bg-pitch-dark opacity-45"
            >
              <span className="flex-1 text-sm text-muted font-semibold">{b.name}</span>
              <span className="text-xs font-mono text-muted">{figuresLabel(b)}</span>
              <span className={cn(
                'text-[10px] font-bold rounded px-1.5 py-0.5 leading-none shrink-0',
                b.isLastBowler ? 'bg-pitch-dark text-muted' : 'bg-wicket/20 text-wicket',
              )}>
                {b.isLastBowler ? 'consecutive' : b.disabledReason}
              </span>
            </div>
          ))}
        </div>
      )}

      <Button
        variant="gold"
        size="lg"
        fullWidth
        disabled={!selected}
        onClick={() => selected && onSelect(selected)}
      >
        {isOpeningBowler ? 'Start Match 🏏' : `Start Over ${completedOverIndex + 1}`}
      </Button>
    </Modal>
  );
}
