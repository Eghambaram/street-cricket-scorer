import type { Innings, Match } from '@/types/match.types';
import type { InningsStats } from '@/types/delivery.types';
import { bowlerOversDisplay } from '@/utils/cricket';
import { econColor } from '@/utils/format';

interface Props {
  match: Match;
  innings: Innings;
  stats: InningsStats;
  onChangeBowler: () => void;
}

export function BowlerPanel({ match, innings, stats, onChangeBowler }: Props) {
  const bowlingTeam = match.teams.find((t) => t.id === innings.bowlingTeamId);
  const playerName  = (id: string) => bowlingTeam?.players.find((p) => p.id === id)?.name ?? 'Bowler';

  if (!innings.currentBowlerId) return null;

  const sc          = stats.bowlerScores[innings.currentBowlerId];
  const maxOvers    = match.rules.maxOversPerBowler;
  const completedOvers = sc ? Math.floor(sc.legalBalls / 6) : 0;
  const atMax       = maxOvers > 0 && completedOvers >= maxOvers;
  const economy     = sc && sc.legalBalls > 0 ? sc.economy : null;
  const figures     = sc ? `${bowlerOversDisplay(sc.legalBalls)}-${sc.maidens}-${sc.runs}-${sc.wickets}` : '0-0-0-0';

  return (
    <div className="bg-pitch-light rounded-xl overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-2 pb-1">
        <span className="text-[11px] font-bold text-muted uppercase tracking-wide">
          Bowling · {bowlingTeam?.name ?? 'Bowling'}
        </span>
      </div>

      <div className="h-px bg-pitch/60 mx-3" />

      {/* Bowler row — full width, tappable */}
      <button
        onClick={onChangeBowler}
        className="w-full flex items-center gap-0 text-left transition-all active:opacity-80 group"
        aria-label="Change bowler"
      >
        {/* Left accent stripe — blue/teal for bowler */}
        <div className="self-stretch w-[3px] rounded-full bg-safe/70 mr-3 shrink-0" />

        {/* Name + tap hint (hint only shown between overs) */}
        <div className="flex-1 min-w-0 py-2.5">
          <p className="font-bold text-white text-sm truncate group-hover:text-safe transition-colors mb-0.5">
            {playerName(innings.currentBowlerId)}
          </p>
          {stats.balls === 0 && (
            <span className="text-[10px] text-muted/40 group-hover:text-muted/70 transition-colors leading-none">
              tap to change
            </span>
          )}
        </div>

        {/* Stats block */}
        <div className="text-right px-3 py-2.5 shrink-0">
          <p className="text-safe text-sm font-mono font-bold leading-none">{figures}</p>
          <div className="flex items-center justify-end gap-2 mt-0.5">
            <span className={`text-[10px] font-bold font-mono ${economy !== null ? econColor(economy) : 'text-muted'}`}>
              {economy !== null ? `${economy.toFixed(1)} econ` : 'econ —'}
            </span>
            {maxOvers > 0 && (
              <span className={`text-[10px] font-mono ${atMax ? 'text-wicket font-bold' : 'text-muted'}`}>
                {completedOvers}/{maxOvers}ov
              </span>
            )}
          </div>
        </div>
      </button>
    </div>
  );
}
