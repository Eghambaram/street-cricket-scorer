import { useUIStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';
import { formatOvers, computeRunRate, computeRequiredRunRate, computeProjectedScore } from '@/utils/cricket';
import type { Delivery, InningsStats } from '@/types/delivery.types';
import type { WicketType } from '@/types/delivery.types';
import type { Match, Innings } from '@/types/match.types';

interface Props {
  match: Match;
  innings: Innings;
  stats: InningsStats;
  inn1Stats?: InningsStats;
  lastDelivery?: Delivery | null;
}

const WICKET_LABELS: Record<WicketType, string> = {
  bowled:            'Bowled',
  caught:            'Caught',
  run_out:           'Run Out',
  stumped:           'Stumped',
  hit_wicket:        'Hit Wicket',
  lbw:               'LBW',
  handled_ball:      'Handled Ball',
  obstructing_field: 'Obstruction',
  one_tip_one_hand:  '1T1H',
};

function formatLastBall(d: Delivery): string {
  if (d.isFreeHit && d.wicket) return `Free Hit — Run Out!`;
  if (d.wicket) return `OUT! ${WICKET_LABELS[d.wicket.type]}`;
  if (d.extras.wide > 0) return d.extras.wide > 1 ? `Wide +${d.extras.wide - 1}` : 'Wide';
  if (d.extras.noBall > 0) return d.runs > 0 ? `No Ball +${d.runs}` : 'No Ball';
  if (d.runs === 6) return 'SIX!';
  if (d.runs === 4) return 'FOUR!';
  if (d.extras.bye > 0) return d.extras.bye === 1 ? 'Bye' : `${d.extras.bye} Byes`;
  if (d.extras.legBye > 0) return d.extras.legBye === 1 ? 'Leg Bye' : `${d.extras.legBye} Leg Byes`;
  if (d.runs === 0) return 'Dot ball';
  return `${d.runs} run${d.runs > 1 ? 's' : ''}`;
}

export function Scoreboard({ match, innings, stats, inn1Stats, lastDelivery }: Props) {
  const { scoreFlash } = useUIStore();

  const battingTeam    = match.teams.find((t) => t.id === innings.battingTeamId);
  const isSecondInnings = innings.inningsNumber === 2;
  const target         = isSecondInnings && inn1Stats ? inn1Stats.totalRuns + 1 : null;
  const remainingBalls = isSecondInnings ? match.config.overs * 6 - stats.legalBalls : null;

  const rr  = computeRunRate(stats.totalRuns, stats.legalBalls);
  const rrr = isSecondInnings && target !== null && remainingBalls !== null
    ? computeRequiredRunRate(target, stats.totalRuns, remainingBalls)
    : null;
  const projected = !isSecondInnings
    ? computeProjectedScore(stats.totalRuns, stats.legalBalls, match.config.overs * 6)
    : null;

  const lastBallText       = lastDelivery ? formatLastBall(lastDelivery) : null;
  const lastBallIsWicket   = !!lastDelivery?.wicket;
  const lastBallIsFreeHit  = !!lastDelivery?.isFreeHit;
  const lastBallIsBoundary = !lastBallIsWicket && (lastDelivery?.runs === 4 || lastDelivery?.runs === 6);
  const lastBallIsNoBall   = !lastBallIsWicket && !lastBallIsBoundary && (lastDelivery?.extras.noBall ?? 0) > 0;
  const lastBallIsWide     = !lastBallIsWicket && !lastBallIsBoundary && (lastDelivery?.extras.wide ?? 0) > 0;

  return (
    <div className="px-4 pt-3 pb-2">
      {/* 1st innings reference — only shown in 2nd innings */}
      {isSecondInnings && inn1Stats && (() => {
        const inn1Team = match.teams.find((t) => t.id !== innings.battingTeamId);
        return (
          <div className="flex items-center justify-between mb-2 px-3 py-1.5 rounded-xl bg-pitch-dark border border-muted/25">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted font-bold uppercase tracking-wide shrink-0">1st Inn</span>
              <span className="text-white/80 text-xs font-bold truncate max-w-[100px]">{inn1Team?.name ?? '?'}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm text-amber">
                {inn1Stats.totalRuns}/{inn1Stats.wickets}
              </span>
              <span className="text-[10px] text-muted font-mono">
                ({Math.floor(inn1Stats.legalBalls / 6)}.{inn1Stats.legalBalls % 6} ov)
              </span>
            </div>
          </div>
        );
      })()}

      {/* Row 1: batting team label + last-ball pill */}
      <div className="flex items-center justify-between mb-1">
        <span className="text-muted text-[11px] font-bold uppercase tracking-wide">
          {battingTeam?.name ?? 'Batting'} · {innings.inningsNumber === 1 ? '1st' : '2nd'} Inn
        </span>
        {lastBallText && (
          <span
            className={cn(
              'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold tracking-wide animate-fade-in',
              lastBallIsWicket   && 'bg-amber/20 text-amber border border-amber/50',
              lastBallIsFreeHit  && !lastBallIsWicket && 'bg-safe/20 text-safe border border-safe/40',
              lastBallIsBoundary && lastDelivery?.runs === 6 && 'bg-six/20 text-six border border-six/45',
              lastBallIsBoundary && lastDelivery?.runs === 4 && 'bg-four/20 text-four border border-four/45',
              lastBallIsNoBall   && 'bg-noball/15 text-noball border border-noball/35',
              lastBallIsWide     && 'bg-wide/15 text-wide border border-wide/35',
              !lastBallIsWicket && !lastBallIsBoundary && !lastBallIsNoBall && !lastBallIsWide && !lastBallIsFreeHit
                && 'bg-pitch-dark text-muted border border-pitch-light/60',
            )}
          >
            {lastBallText}
          </span>
        )}
      </div>

      {/* Row 2: big score + overs */}
      <div className="flex items-end justify-between">
        <div className="flex items-end gap-1.5">
          <span
            key={scoreFlash}
            className="font-display text-6xl text-white leading-none animate-score-pulse"
          >
            {stats.totalRuns}
          </span>
          <span className="font-display text-4xl text-muted leading-none mb-0.5">
            /{stats.wickets}
          </span>
        </div>
        <div className="text-right mb-1">
          <p className="text-white font-mono text-sm font-bold leading-tight">
            {formatOvers(stats.legalBalls, match.config.overs)}
          </p>
          <p className="text-muted text-[10px] leading-tight">overs</p>
        </div>
      </div>

      {/* Row 3: run rates — dynamic colour pressure logic (audit recommendation) */}
      <div className="flex items-center flex-wrap gap-x-4 gap-y-0 mt-1">
        {/* CRR — green when comfortable, amber when under pressure, red when critical */}
        {(() => {
          let rrColour = 'text-runs';
          if (rrr !== null) {
            const gap = rrr - rr;
            if (gap >= 4) rrColour = 'text-wicket';
            else if (gap >= 1) rrColour = 'text-amber';
          }
          return (
            <span className="text-muted text-xs">
              RR <span className={cn('font-bold', rrColour)}>{rr.toFixed(2)}</span>
            </span>
          );
        })()}
        {rrr !== null && target !== null && (
          <span className={cn(
            'text-sm font-black tracking-tight',
            rrr - rr >= 4 ? 'text-wicket' : rrr - rr >= 1 ? 'text-amber' : 'text-runs',
          )}>
            Need {Math.max(0, target - stats.totalRuns)} off {remainingBalls}b
          </span>
        )}
        {rrr !== null && (
          <span className="text-muted text-xs">
            RRR <span className={cn(
              'font-bold',
              rrr - rr >= 4 ? 'text-wicket' : rrr - rr >= 1 ? 'text-amber' : 'text-runs',
            )}>{rrr.toFixed(2)}</span>
          </span>
        )}
        {projected !== null && stats.legalBalls > 0 && (
          <span className="text-muted text-xs">
            Proj <span className="text-white font-bold">{projected}</span>
          </span>
        )}
      </div>

      {/* Target bar — 2nd innings only */}
      {isSecondInnings && target !== null && (
        <div className="mt-2">
          <div className="h-1.5 bg-pitch-dark rounded-full overflow-hidden">
            <div
              className="h-full bg-runs rounded-full transition-all duration-300"
              style={{ width: `${Math.min((stats.totalRuns / target) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] text-muted mt-0.5">
            <span>Target <span className="text-amber font-bold">{target}</span></span>
            {target - stats.totalRuns > 0
              ? <span>Need <span className="text-white font-semibold">{target - stats.totalRuns}</span></span>
              : <span className="text-runs font-bold">Target reached!</span>
            }
          </div>
        </div>
      )}
    </div>
  );
}
