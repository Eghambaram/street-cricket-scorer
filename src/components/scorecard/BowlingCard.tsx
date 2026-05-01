import { Pencil } from 'lucide-react';
import type { Innings, Match } from '@/types/match.types';
import type { InningsStats } from '@/types/delivery.types';
import { bowlerOversDisplay } from '@/utils/cricket';
import { econColor } from '@/utils/format';
import { cn } from '@/utils/cn';

interface Props {
  match: Match;
  innings: Innings;
  stats: InningsStats;
  onEditPlayer?: (playerId: string) => void;
}

export function BowlingCard({ match, innings, stats, onEditPlayer }: Props) {
  const bowlingTeam = match.teams.find((t) => t.id === innings.bowlingTeamId);
  const playerName = (id: string) =>
    bowlingTeam?.players.find((p) => p.id === id)?.name ?? id;

  const bowlers = Object.values(stats.bowlerScores)
    .filter((b) => b.legalBalls > 0)
    .sort((a, b) => {
      const ai = bowlingTeam?.players.findIndex((p) => p.id === a.playerId) ?? 0;
      const bi = bowlingTeam?.players.findIndex((p) => p.id === b.playerId) ?? 0;
      return ai - bi;
    });

  // Best bowler: most wickets, then lowest economy
  const bestBowlerId = bowlers.reduce<string | null>((best, b) => {
    if (b.wickets === 0) return best;
    if (!best) return b.playerId;
    const bst = stats.bowlerScores[best];
    if (b.wickets !== bst.wickets) return b.wickets > bst.wickets ? b.playerId : best;
    return b.economy < bst.economy ? b.playerId : best;
  }, null);

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-pitch-light">
            <th className="text-left py-2 font-semibold text-muted">Bowler</th>
            <th className="text-right py-2 w-10 font-semibold text-muted">O</th>
            <th className="text-right py-2 w-10 font-semibold text-muted">M</th>
            <th className="text-right py-2 w-10 font-semibold text-muted">R</th>
            <th className="text-right py-2 w-10 font-semibold text-wicket">W</th>
            <th className="text-right py-2 w-14 font-semibold text-muted">Econ</th>
          </tr>
        </thead>
        <tbody>
          {bowlers.map((bwl) => {
            const hasFiveFor = bwl.wickets >= 5;
            const isBest = bwl.playerId === bestBowlerId;
            return (
              <tr
                key={bwl.playerId}
                className={cn(
                  'border-b border-pitch-light/20',
                  isBest ? 'bg-wicket/[0.06]' : '',
                )}
              >
                <td className="py-2.5">
                  <div className="flex items-center gap-1.5 group">
                    {isBest && (
                      <span className="text-[9px] font-black text-wicket leading-none">★</span>
                    )}
                    <span className="font-semibold text-white">{playerName(bwl.playerId)}</span>
                    {hasFiveFor && (
                      <span className="text-[10px] font-black text-gold border border-gold/40 rounded px-1 leading-none">5W</span>
                    )}
                    {bwl.maidens > 0 && (
                      <span className="text-[10px] font-semibold text-runs leading-none">M</span>
                    )}
                    {onEditPlayer && (
                      <button
                        onClick={() => onEditPlayer(bwl.playerId)}
                        className="text-muted hover:text-gold transition-all p-0.5 flex-shrink-0"
                        aria-label="Edit name"
                      >
                        <Pencil size={11} />
                      </button>
                    )}
                  </div>
                </td>
                <td className="text-right font-mono text-white">{bowlerOversDisplay(bwl.legalBalls)}</td>
                <td className="text-right text-muted">{bwl.maidens}</td>
                <td className="text-right text-muted">{bwl.runs}</td>
                <td className={cn('text-right font-black text-base', bwl.wickets > 0 ? 'text-wicket' : 'text-muted')}>
                  {bwl.wickets}
                </td>
                <td className={cn('text-right font-mono text-xs font-semibold', econColor(bwl.economy))}>
                  {bwl.economy.toFixed(1)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
