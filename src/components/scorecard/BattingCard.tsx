import { Pencil } from 'lucide-react';
import type { Innings, Match } from '@/types/match.types';
import type { InningsStats } from '@/types/delivery.types';
import { formatScore, formatOversShort } from '@/utils/format';
import { computeRunRate } from '@/utils/cricket';
import { cn } from '@/utils/cn';

interface Props {
  match: Match;
  innings: Innings;
  stats: InningsStats;
  onEditPlayer?: (playerId: string) => void;
}

function milestone(runs: number): string | null {
  if (runs >= 100) return '💯';
  if (runs >= 50) return '★';
  return null;
}

export function BattingCard({ match, innings, stats, onEditPlayer }: Props) {
  const battingTeam = match.teams.find((t) => t.id === innings.battingTeamId);
  const playerName  = (id: string) => battingTeam?.players.find((p) => p.id === id)?.name ?? id;

  const orderedBatsmen = innings.battingOrder
    .map((id) => stats.batsmanScores[id])
    .filter(Boolean);

  // Players who haven't batted yet
  const usedIds    = new Set(innings.battingOrder);
  const yetToBat   = (battingTeam?.players ?? []).filter((p) => !usedIds.has(p.id));
  const retiredIds = new Set(innings.retiredHurtIds ?? []);

  // Top scorer (not out only — highlight live performer)
  const topScorerId = orderedBatsmen.reduce<string | null>((best, b) => {
    if (b.isOut) return best;
    if (!best) return b.runs > 0 ? b.playerId : null;
    const bestRuns = stats.batsmanScores[best]?.runs ?? 0;
    return b.runs > bestRuns ? b.playerId : best;
  }, null);

  const rr = computeRunRate(stats.totalRuns, stats.legalBalls);

  return (
    <div className="rounded-2xl overflow-hidden bg-pitch-light border border-white/[0.06]">
      {/* Section header */}
      <div className="flex items-center justify-between px-4 pt-3 pb-2 border-b border-white/[0.05]">
        <span className="text-[10px] font-black text-muted uppercase tracking-[2px]">Batting</span>
        <span className="text-[10px] font-mono text-muted/60">
          {formatScore(stats.totalRuns, stats.wickets)} · {formatOversShort(stats.legalBalls)} ov · RR {rr.toFixed(2)}
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-3 px-4 py-1.5 border-b border-white/[0.04]">
        <span className="text-[10px] font-bold text-muted/60">Batsman</span>
        <span className="text-[10px] font-bold text-muted/60 w-7 text-right">R</span>
        <span className="text-[10px] font-bold text-muted/60 w-7 text-right">B</span>
        <span className="text-[10px] font-bold text-four/70 w-7 text-right">4s</span>
        <span className="text-[10px] font-bold text-six/70 w-7 text-right">6s</span>
        <span className="text-[10px] font-bold text-muted/60 w-12 text-right">SR</span>
      </div>

      {/* Batsmen rows */}
      <div>
        {orderedBatsmen.map((bs, idx) => {
          const badge     = milestone(bs.runs);
          const isStriker = !bs.isOut && innings.currentBatsmanIds[innings.strikerIndex] === bs.playerId;
          const isTop     = bs.playerId === topScorerId;
          const isRetired = retiredIds.has(bs.playerId);

          return (
            <div
              key={bs.playerId}
              className={cn(
                'grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-x-3 px-4 py-2.5 items-center',
                'border-b border-white/[0.04] last:border-0',
                isTop ? 'bg-gold/[0.05]' : idx % 2 !== 0 ? 'bg-black/[0.04]' : '',
                bs.isOut && !isRetired ? 'opacity-55' : '',
              )}
            >
              {/* Name cell */}
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {isTop && (
                    <span className="text-[8px] font-black text-gold leading-none">★</span>
                  )}
                  <span className={cn(
                    'font-semibold text-sm leading-tight truncate',
                    bs.isOut && !isRetired ? 'text-muted' : 'text-white',
                  )}>
                    {playerName(bs.playerId)}
                  </span>
                  {isStriker && (
                    <span className="shrink-0 text-[8px] font-black bg-gold/20 text-gold border border-gold/30 rounded px-1 leading-none uppercase tracking-wide">bat</span>
                  )}
                  {isRetired && (
                    <span className="shrink-0 text-[8px] font-black bg-amber/15 text-amber border border-amber/30 rounded px-1 leading-none">ret</span>
                  )}
                  {badge && <span className="shrink-0 text-[10px] leading-none">{badge}</span>}
                  {onEditPlayer && (
                    <button
                      onClick={() => onEditPlayer(bs.playerId)}
                      className="shrink-0 text-muted/40 hover:text-gold transition-colors p-0.5"
                      aria-label="Edit name"
                    >
                      <Pencil size={10} />
                    </button>
                  )}
                </div>
                {bs.isOut && !isRetired && (
                  <p className="text-[10px] text-muted/60 leading-tight mt-0.5 truncate">{bs.dismissalText}</p>
                )}
                {!bs.isOut && !isRetired && bs.balls > 0 && (
                  <p className="text-[10px] text-runs font-bold leading-tight mt-0.5">not out</p>
                )}
                {isRetired && (
                  <p className="text-[10px] text-amber/70 leading-tight mt-0.5">retired hurt</p>
                )}
              </div>

              {/* Stat cells */}
              <span className={cn(
                'font-black text-sm w-7 text-right tabular-nums',
                isTop ? 'text-gold' : 'text-white',
              )}>
                {bs.runs}
              </span>
              <span className="text-muted text-xs w-7 text-right tabular-nums">{bs.balls}</span>
              <span className={cn(
                'text-xs w-7 text-right tabular-nums font-mono',
                bs.fours > 0 ? 'text-four font-bold' : 'text-muted/50',
              )}>
                {bs.fours}
              </span>
              <span className={cn(
                'text-xs w-7 text-right tabular-nums font-mono',
                bs.sixes > 0 ? 'text-six font-bold' : 'text-muted/50',
              )}>
                {bs.sixes}
              </span>
              <span className={cn(
                'text-xs w-12 text-right tabular-nums font-mono',
                bs.balls > 0 && bs.strikeRate >= 150 ? 'text-gold font-bold' : 'text-muted/60',
              )}>
                {bs.balls > 0 ? bs.strikeRate.toFixed(1) : '—'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Yet to bat */}
      {yetToBat.length > 0 && (
        <div className="border-t border-white/[0.06] px-4 py-2">
          <p className="text-[9px] font-black text-muted/50 uppercase tracking-[2px] mb-1.5">Yet to bat</p>
          <div className="flex flex-wrap gap-1.5">
            {yetToBat.map((p) => (
              <span
                key={p.id}
                className="text-[11px] font-semibold text-muted/70 bg-pitch-dark border border-white/[0.06] rounded-lg px-2 py-1 leading-none"
              >
                {p.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Extras + total footer */}
      <div className="border-t border-white/[0.06] px-4 py-3 space-y-1.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-[11px] flex-wrap">
            <span className="text-muted/60 font-semibold">Extras</span>
            <span className="text-wide/80 font-semibold">Wd {stats.extras.wides}</span>
            <span className="text-muted/30">·</span>
            <span className="text-noball/80 font-semibold">NB {stats.extras.noBalls}</span>
            <span className="text-muted/30">·</span>
            <span className="text-muted/60">B {stats.extras.byes}</span>
            <span className="text-muted/30">·</span>
            <span className="text-muted/60">LB {stats.extras.legByes}</span>
          </div>
          <span className="font-bold text-white text-sm">{stats.extrasTotal}</span>
        </div>
        <div className="flex items-baseline justify-between">
          <span className="font-black text-white text-lg">
            {formatScore(stats.totalRuns, stats.wickets)}
            <span className="text-muted font-normal text-xs ml-1.5">({formatOversShort(stats.legalBalls)} ov)</span>
          </span>
          <span className="text-muted text-xs font-mono">RR {rr.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
