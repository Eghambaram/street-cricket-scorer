import { CheckCircle2 } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { cn } from '@/utils/cn';
import { econColor } from '@/utils/format';
import { bowlerOversDisplay } from '@/utils/cricket';
import type { Innings, Match } from '@/types/match.types';
import type { InningsStats } from '@/types/delivery.types';

interface Props {
  isOpen: boolean;
  match: Match;
  innings: Innings;
  stats: InningsStats;
  onConfirm: (bowlerId: string) => void;
  onClose: () => void;
}

export function ChangeBowlerModal({ isOpen, match, innings, stats, onConfirm, onClose }: Props) {
  const bowlingTeam = match.teams.find((t) => t.id === innings.bowlingTeamId);
  const maxOvers = match.rules.maxOversPerBowler;

  const options = (bowlingTeam?.players ?? []).map((p) => {
    const sc = stats.bowlerScores[p.id];
    const completedOvers = sc ? Math.floor(sc.legalBalls / 6) : 0;
    const isCurrent = p.id === innings.currentBowlerId;
    const reachedMax = maxOvers > 0 && completedOvers >= maxOvers;
    const canBowl = !isCurrent && !reachedMax;
    const disabledReason = isCurrent ? 'bowling now' : reachedMax ? `max ${maxOvers} ov` : null;
    const econ = sc && sc.legalBalls > 0 ? sc.economy : null;
    const figures = sc && sc.legalBalls > 0
      ? `${bowlerOversDisplay(sc.legalBalls)}-${sc.maidens}-${sc.runs}-${sc.wickets}`
      : '—';
    return { ...p, sc, completedOvers, isCurrent, reachedMax, canBowl, disabledReason, econ, figures };
  });

  // Sort eligible: fewest overs bowled first, then alphabetical
  const eligible = options
    .filter((b) => b.canBowl)
    .sort((a, b) => a.completedOvers - b.completedOvers || a.name.localeCompare(b.name));

  const ineligible = options.filter((b) => !b.canBowl);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Change Bowler">
      <p className="text-muted text-xs text-center mb-3">
        Current over continues — partial over counts for previous bowler
      </p>

      {eligible.length === 0 ? (
        <p className="text-muted text-sm text-center py-4">No other bowlers available.</p>
      ) : (
        <div className="space-y-2 mb-3">
          {eligible.map((b) => (
            <button
              key={b.id}
              onClick={() => onConfirm(b.id)}
              className={cn(
                'w-full flex items-center gap-3 rounded-xl px-4 py-3 border transition-all active:scale-[0.98] text-left',
                'bg-pitch-dark border-pitch-light hover:border-gold/50 hover:bg-pitch-light/30',
              )}
            >
              {/* Name */}
              <span className="flex-1 font-semibold text-white text-sm truncate">{b.name}</span>

              {/* Figures */}
              <span className="text-xs font-mono text-muted shrink-0">{b.figures}</span>

              {/* Economy badge */}
              {b.econ !== null && (
                <span className={cn('text-xs font-bold font-mono w-14 text-right shrink-0', econColor(b.econ))}>
                  {b.econ.toFixed(1)} econ
                </span>
              )}

              {/* Over cap progress */}
              {maxOvers > 0 && (
                <span className="text-xs text-muted font-mono w-10 text-right shrink-0">
                  {b.completedOvers}/{maxOvers}
                </span>
              )}

              <CheckCircle2 size={14} className="text-muted/20 shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Ineligible bowlers — dimmed with reason tag */}
      {ineligible.length > 0 && (
        <div className="space-y-1.5">
          {ineligible.map((b) => (
            <div
              key={b.id}
              className="flex items-center gap-3 rounded-xl px-4 py-2.5 border border-pitch-dark bg-pitch-dark opacity-45"
            >
              <span className="flex-1 text-sm text-muted font-semibold truncate">{b.name}</span>
              <span className="text-xs font-mono text-muted shrink-0">{b.figures}</span>
              <span className={cn(
                'text-[10px] font-bold rounded px-1.5 py-0.5 leading-none shrink-0',
                b.isCurrent ? 'bg-pitch-dark text-muted' : 'bg-wicket/20 text-wicket',
              )}>
                {b.disabledReason}
              </span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
