import type { Innings, Match } from '@/types/match.types';
import type { FallOfWicket } from '@/types/delivery.types';
import { formatOversShort } from '@/utils/format';

interface Props {
  match: Match;
  innings: Innings;
  fallOfWickets: FallOfWicket[];
}

export function FOWTable({ match, innings, fallOfWickets }: Props) {
  if (fallOfWickets.length === 0) return null;
  const battingTeam = match.teams.find((t) => t.id === innings.battingTeamId);
  const playerName  = (id: string) => battingTeam?.players.find((p) => p.id === id)?.name ?? id;

  return (
    <div className="rounded-2xl overflow-hidden bg-pitch-light border border-white/[0.06]">
      <div className="px-4 pt-3 pb-2 border-b border-white/[0.04]">
        <span className="text-[10px] font-black text-muted uppercase tracking-[2px]">Fall of Wickets</span>
      </div>
      <div className="px-3 py-2 flex flex-wrap gap-1.5">
        {fallOfWickets.map((fow) => (
          <div
            key={fow.wicketNumber}
            className="flex items-center gap-1.5 bg-pitch-dark border border-white/[0.05] rounded-xl px-2.5 py-1.5"
          >
            <span className="w-4 h-4 rounded-full bg-wicket/20 text-wicket text-[9px] font-black flex items-center justify-center shrink-0">
              {fow.wicketNumber}
            </span>
            <span className="font-mono font-black text-white text-xs">{fow.runs}</span>
            <span className="text-muted text-[11px] truncate max-w-[72px]">{playerName(fow.batsmanId)}</span>
            <span className="text-muted/50 text-[10px] font-mono shrink-0">{formatOversShort(fow.legalBalls)}ov</span>
          </div>
        ))}
      </div>
    </div>
  );
}
