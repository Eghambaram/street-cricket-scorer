import { HeartPulse, UserRound, CheckCircle2 } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { cn } from '@/utils/cn';
import type { Innings, Match } from '@/types/match.types';
import type { InningsStats } from '@/types/delivery.types';

interface Props {
  isOpen: boolean;
  position: 0 | 1;
  context?: 'post_wicket' | 'voluntary';
  match: Match;
  innings: Innings;
  stats: InningsStats;
  onConfirm: (playerId: string) => void;
  onRecall: (playerId: string) => void;
  onClose: () => void;
}

export function ChangeBatsmanModal({
  isOpen, position, context = 'voluntary', match, innings, stats, onConfirm, onRecall, onClose,
}: Props) {
  const battingTeam = match.teams.find((t) => t.id === innings.battingTeamId);
  const isStriker = innings.strikerIndex === position;
  const isPostWicket = context === 'post_wicket';

  const title = isPostWicket
    ? 'New Batsman In'
    : isStriker ? 'Change Striker' : 'Change Non-Striker';

  const retiredHurtIds = new Set(innings.retiredHurtIds ?? []);

  const dismissedIds = new Set(
    Object.entries(stats.batsmanScores)
      .filter(([, sc]) => sc.isOut)
      .map(([id]) => id),
  );

  const atCrease = new Set(innings.currentBatsmanIds.filter(Boolean) as string[]);

  // Fresh players not yet used — preserve team roster order for batting position
  const eligible = (battingTeam?.players ?? []).filter(
    (p) => !atCrease.has(p.id) && !dismissedIds.has(p.id) && !retiredHurtIds.has(p.id),
  );

  // Retired hurt players available for recall
  const canRecall = (battingTeam?.players ?? []).filter((p) => retiredHurtIds.has(p.id));

  const hasAnyone = eligible.length > 0 || canRecall.length > 0;

  // Batting position = 1-based index in team roster
  const battingPosition = (id: string) =>
    (battingTeam?.players.findIndex((p) => p.id === id) ?? -1) + 1;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>

      {/* Post-wicket context banner */}
      {isPostWicket && (
        <div className="flex items-center gap-2 bg-wicket/10 border border-wicket/25 rounded-xl px-3 py-2 mb-4">
          <UserRound size={14} className="text-wicket shrink-0" />
          <p className="text-wicket text-xs font-semibold">
            Wicket fell — select the next batsman to continue
          </p>
        </div>
      )}

      {!hasAnyone ? (
        <p className="text-muted text-sm text-center py-4">No available batsmen.</p>
      ) : (
        <div className="space-y-4">

          {/* Yet to bat */}
          {eligible.length > 0 && (
            <div>
              {canRecall.length > 0 && (
                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                  Yet to Bat
                </p>
              )}
              <div className="space-y-1.5">
                {eligible.map((player) => {
                  const pos = battingPosition(player.id);
                  const sc = stats.batsmanScores[player.id];
                  return (
                    <button
                      key={player.id}
                      onClick={() => onConfirm(player.id)}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-xl px-4 py-3 border transition-all active:scale-[0.98] text-left',
                        isPostWicket
                          ? 'bg-pitch-dark border-pitch-light hover:border-gold hover:bg-gold/5'
                          : 'bg-pitch-dark border-pitch-light hover:border-gold/50 hover:bg-pitch-light/30',
                      )}
                    >
                      {/* Batting position badge */}
                      <span className="w-7 h-7 rounded-lg bg-pitch-light text-muted text-xs font-black flex items-center justify-center shrink-0">
                        {pos > 0 ? pos : '—'}
                      </span>
                      <span className="flex-1 font-semibold text-white text-sm truncate">
                        {player.name}
                      </span>
                      {sc ? (
                        <span className="text-xs text-muted font-mono shrink-0">
                          {sc.runs} ({sc.balls})
                        </span>
                      ) : (
                        <span className="text-xs text-muted/50 shrink-0">yet to bat</span>
                      )}
                      <CheckCircle2 size={14} className="text-muted/20 shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recall retired hurt */}
          {canRecall.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <HeartPulse size={12} className="text-gold" />
                Recall Retired Hurt
              </p>
              <div className="space-y-1.5">
                {canRecall.map((player) => {
                  const sc = stats.batsmanScores[player.id];
                  return (
                    <button
                      key={player.id}
                      onClick={() => onRecall(player.id)}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-xl px-4 py-3 border transition-all active:scale-[0.98] text-left',
                        'bg-gold/10 border-gold/30 hover:border-gold hover:bg-gold/15',
                      )}
                    >
                      <span className="w-7 h-7 rounded-lg bg-gold/25 flex items-center justify-center shrink-0">
                        <HeartPulse size={13} className="text-gold" />
                      </span>
                      <span className="flex-1 font-semibold text-gold text-sm truncate">
                        {player.name}
                      </span>
                      {sc && (
                        <div className="text-right shrink-0">
                          <p className="text-sm font-black text-gold">{sc.runs}</p>
                          <p className="text-[10px] text-muted font-mono">({sc.balls}b)</p>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
