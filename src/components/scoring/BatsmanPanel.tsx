import { ArrowLeftRight } from 'lucide-react';
import type { Innings, Match } from '@/types/match.types';
import type { InningsStats } from '@/types/delivery.types';
import { cn } from '@/utils/cn';

interface Props {
  match: Match;
  innings: Innings;
  stats: InningsStats;
  onRotateStrike: () => void;
  onChangeBatsman: (position: 0 | 1) => void;
}

export function BatsmanPanel({ match, innings, stats, onRotateStrike, onChangeBatsman }: Props) {
  const battingTeam = match.teams.find((t) => t.id === innings.battingTeamId);
  const playerName  = (id: string) => battingTeam?.players.find((p) => p.id === id)?.name ?? 'Batsman';

  const lastManStands = match.rules.lastManStands;
  const [id0, id1]    = innings.currentBatsmanIds;
  const strikerIdx    = innings.strikerIndex;
  const bothPresent   = !!(id0 && id0 !== '' && id1 && id1 !== '' && id0 !== id1);

  const strikerPos    = strikerIdx as 0 | 1;
  const nonStrikerPos = (strikerIdx ^ 1) as 0 | 1;
  const strikerId     = innings.currentBatsmanIds[strikerPos];
  const nonStrikerId  = innings.currentBatsmanIds[nonStrikerPos];

  const BatsmanRow = ({
    id,
    position,
    isStriker,
  }: {
    id: string | null | undefined;
    position: 0 | 1;
    isStriker: boolean;
  }) => {
    if (!id || id === '') {
      if (!isStriker && lastManStands) {
        return (
          <div className="flex items-center gap-3 px-3 py-2.5">
            <div className="w-1 self-stretch rounded-full bg-muted/20" />
            <span className="text-xs italic font-semibold text-muted/60">Last Man Standing</span>
          </div>
        );
      }
      return null;
    }

    const sc   = stats.batsmanScores[id];
    const runs = sc?.runs ?? 0;
    const balls = sc?.balls ?? 0;
    const fours = sc?.fours ?? 0;
    const sixes = sc?.sixes ?? 0;
    const sr   = balls > 0 ? Math.round((runs / balls) * 100) : 0;

    return (
      <button
        onClick={() => onChangeBatsman(position)}
        className={cn(
          'w-full flex items-center gap-0 text-left transition-all active:opacity-80 group',
          isStriker ? 'bg-gold/[0.07]' : '',
        )}
        aria-label={`Change ${isStriker ? 'striker' : 'non-striker'}`}
      >
        {/* Coloured left stripe — gold for striker, faint for non-striker */}
        <div
          className={cn(
            'self-stretch w-[3px] rounded-full mr-3 shrink-0',
            isStriker ? 'bg-gold' : 'bg-muted/30',
          )}
        />

        {/* Name + role badge */}
        <div className="flex-1 min-w-0 py-2.5">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className={cn(
              'font-bold text-sm truncate',
              isStriker ? 'text-white' : 'text-muted',
            )}>
              {playerName(id)}
            </span>
            <span className={cn(
              'shrink-0 text-[9px] font-black rounded px-1.5 py-0.5 leading-none uppercase tracking-wide',
              isStriker
                ? 'bg-gold text-pitch-dark'
                : 'bg-pitch-dark text-muted',
            )}>
              {isStriker ? '★ Striker' : 'Non-str'}
            </span>
          </div>
          <span className="text-[10px] text-muted/40 group-hover:text-muted/70 transition-colors leading-none">
            tap to change
          </span>
        </div>

        {/* Score block */}
        <div className="text-right px-3 py-2.5 shrink-0">
          <div className={cn('font-mono font-black text-2xl leading-none', isStriker ? 'text-white' : 'text-muted')}>
            {runs}
            <span className={cn('text-sm font-normal ml-0.5', isStriker ? 'text-white/60' : 'text-muted/60')}>
              ({balls})
            </span>
          </div>
          <div className="text-[10px] text-muted/70 mt-0.5 font-mono">
            {balls > 0 ? `SR ${sr}` : '—'}
            {(fours > 0 || sixes > 0) && (
              <span className="ml-1.5">
                {fours > 0 && <span className="text-four">{fours}×4</span>}
                {fours > 0 && sixes > 0 && ' '}
                {sixes > 0 && <span className="text-six">{sixes}×6</span>}
              </span>
            )}
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="bg-pitch-light rounded-xl overflow-hidden">
      {/* Header row */}
      <div className="flex items-center justify-between px-3 pt-2 pb-1">
        <span className="text-[11px] font-bold text-muted uppercase tracking-wide">Batting</span>
        {bothPresent && (
          <button
            onClick={onRotateStrike}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-gold border border-gold/40 hover:bg-gold/10 active:scale-95 transition-all min-h-[28px]"
            aria-label="Rotate strike"
          >
            <ArrowLeftRight size={11} />
            <span>Rotate</span>
          </button>
        )}
      </div>

      {/* Divider */}
      <div className="h-px bg-pitch/60 mx-3" />

      {/* Striker always first */}
      <BatsmanRow id={strikerId} position={strikerPos} isStriker />

      {/* Partnership divider with stats */}
      {bothPresent && (() => {
        const s1 = stats.batsmanScores[strikerId ?? ''];
        const s2 = stats.batsmanScores[nonStrikerId ?? ''];
        const pRuns = (s1?.runs ?? 0) + (s2?.runs ?? 0);
        const pBalls = (s1?.balls ?? 0) + (s2?.balls ?? 0);
        return (
          <div className="flex items-center gap-2 px-3 py-1 bg-pitch/40">
            <div className="flex-1 h-px bg-pitch-light/60" />
            <span className="text-[10px] text-muted/60 font-mono shrink-0">
              Partnership <span className="text-white/70 font-bold">{pRuns}</span>
              <span className="text-muted/50"> ({pBalls}b)</span>
            </span>
            <div className="flex-1 h-px bg-pitch-light/60" />
          </div>
        );
      })()}

      {/* Non-striker */}
      <BatsmanRow id={nonStrikerId === strikerId ? '' : nonStrikerId} position={nonStrikerPos} isStriker={false} />
    </div>
  );
}
