import type { Innings, Match } from '@/types/match.types';
import type { OverSummary } from '@/types/delivery.types';
import { ballSymbol, ballBadgeClass } from '@/utils/cricket';

interface Props {
  match: Match;
  innings: Innings;
  overSummaries: OverSummary[];
}

export function OverByOver({ match, innings, overSummaries }: Props) {
  const bowlingTeam = match.teams.find((t) => t.id === innings.bowlingTeamId);
  const playerName = (id: string) =>
    bowlingTeam?.players.find((p) => p.id === id)?.name ?? id;

  let cumulative = 0;

  return (
    <div className="space-y-1.5">
      {overSummaries.map((ov) => {
        cumulative += ov.runs;
        const runningTotal = cumulative;
        return (
          <div key={ov.overIndex} className="bg-pitch-dark rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-3 py-2 border-b border-pitch/40">
              <div className="flex items-center gap-2">
                <span className="text-muted text-xs font-bold w-12">Ov {ov.overIndex + 1}</span>
                <span className="text-white/60 text-xs truncate max-w-[110px]">{playerName(ov.bowlerId)}</span>
              </div>
              <div className="flex items-center gap-2">
                {ov.isMaiden && (
                  <span className="text-[10px] font-black text-runs border border-runs/30 rounded px-1 leading-none">M</span>
                )}
                {ov.wickets > 0 && (
                  <span className="text-xs font-bold text-wicket">{ov.wickets}W</span>
                )}
                <span className="text-xs font-bold text-white w-7 text-right">{ov.runs}R</span>
                <span className="text-xs text-muted font-mono w-10 text-right">{runningTotal}</span>
              </div>
            </div>
            {/* Larger badges than live OverTracker — this is a reference view */}
            <div className="flex items-center gap-1.5 flex-wrap px-3 py-2.5">
              {ov.deliveries.map((d) => (
                <span
                  key={d.id}
                  className={`inline-flex items-center justify-center rounded-lg min-w-[36px] h-9 text-sm font-bold px-1.5 ${ballBadgeClass(d)}`}
                >
                  {ballSymbol(d)}
                </span>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
