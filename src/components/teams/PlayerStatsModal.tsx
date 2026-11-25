import { useEffect, useState } from 'react';
import { BarChart2, TrendingUp, TrendingDown } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import { computeCareerStats, formatBestBowling } from '@/utils/playerStats';
import { MIN_QUALIFYING_INNINGS } from '@/utils/season';
import { cn } from '@/utils/cn';
import type { CareerStats } from '@/utils/playerStats';

interface Props {
  isOpen: boolean;
  playerId: string;
  playerName: string;
  /** Season to show; omit for all completed matches. */
  seasonId?: string;
  seasonName?: string;
  onClose: () => void;
}

// ── Stat cell ─────────────────────────────────────────────────────────────────

function StatCell({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <div className="bg-pitch rounded-xl px-2 py-3 text-center relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.07] to-transparent" />
      <p className={cn('font-bold text-lg leading-none', accent ?? 'text-white')}>{value}</p>
      <p className="text-muted text-[11px] mt-1.5 leading-none font-medium">{label}</p>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, label, color }: { icon: typeof TrendingUp; label: string; color: string }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      <div className={cn('w-1 h-4 rounded-full', color)} />
      <Icon size={13} className={cn('shrink-0', color.replace('bg-', 'text-'))} />
      <p className="text-xs font-bold text-white/70 uppercase tracking-wider">{label}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PlayerStatsModal({ isOpen, playerId, playerName, seasonId, seasonName, onClose }: Props) {
  const [stats, setStats]     = useState<CareerStats | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !playerId) return;
    setLoading(true);
    setStats(null);
    computeCareerStats(playerId, seasonId)
      .then(setStats)
      .finally(() => setLoading(false));
  }, [isOpen, playerId, seasonId]);

  const hasBowling = stats && stats.bowlingInnings > 0;
  const battingQualified = !!stats && stats.battingInnings >= MIN_QUALIFYING_INNINGS;
  const bowlingQualified = !!stats && stats.bowlingInnings >= MIN_QUALIFYING_INNINGS;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={playerName}>
      {loading ? (
        <div className="flex justify-center py-10">
          <Spinner />
        </div>
      ) : !stats ? null : stats.matches === 0 ? (
        /* ── No data ── */
        <div className="text-center py-8 space-y-2">
          <p className="text-5xl select-none">🏟️</p>
          <p className="text-white font-bold mt-3">No match history yet</p>
          <p className="text-muted text-sm leading-relaxed">
            {seasonId
              ? `No completed ${seasonName ?? 'season'} matches for this player yet.`
              : 'Play a match with this player to see their career stats here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4 pb-1">

          {/* ── Summary strip ── */}
          <div className="flex items-center gap-2 pb-3 border-b border-white/[0.07]">
            <div className="flex items-center gap-1.5 flex-1">
              <BarChart2 size={14} className="text-gold shrink-0" />
              <span className="text-muted text-sm">
                <span className="text-white font-bold">{stats.matches}</span>{' '}
                match{stats.matches !== 1 ? 'es' : ''}
              </span>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-safe/20 text-safe border border-safe/30">
              {seasonName ?? 'All matches'}
            </span>
          </div>

          {/* ── Batting ── */}
          <div>
            <SectionHeader icon={TrendingUp} label="Batting" color="bg-runs" />
            {stats.battingInnings === 0 ? (
              <div className="text-center py-4 bg-pitch rounded-xl">
                <p className="text-2xl mb-1 select-none">🏏</p>
                <p className="text-muted text-sm">No batting innings yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-1.5">
                  <StatCell label="Inns"  value={stats.battingInnings} />
                  <StatCell label="Runs"  value={stats.totalRuns}       accent="text-runs" />
                  <StatCell label="HS"    value={stats.highScore}        />
                  <StatCell label="Avg"   value={battingQualified ? stats.battingAverage : '—'} />
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <StatCell label="SR"   value={stats.strikeRate}  />
                  <StatCell label="50s"  value={stats.fifties}      />
                  <StatCell label="100s" value={stats.hundreds}     />
                  <StatCell label="6s"   value={stats.sixes}        accent="text-six" />
                </div>
              </div>
            )}
          </div>

          {/* ── Bowling ── */}
          <div>
            <SectionHeader icon={TrendingDown} label="Bowling" color="bg-amber" />
            {!hasBowling ? (
              <div className="text-center py-4 bg-pitch rounded-xl">
                <p className="text-2xl mb-1 select-none">🎳</p>
                <p className="text-muted text-sm">No bowling innings yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-1.5">
                  <StatCell label="Inns"  value={stats.bowlingInnings} />
                  <StatCell label="Wkts"  value={stats.wickets}          accent="text-amber" />
                  <StatCell label="Runs"  value={stats.runsConceded}     />
                  <StatCell label="Avg"   value={bowlingQualified && stats.wickets > 0 ? stats.bowlingAverage : '—'} />
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <StatCell label="Econ"  value={bowlingQualified ? stats.economy : '—'} />
                  <StatCell label="Best"  value={formatBestBowling(stats.bestBowlingWickets, stats.bestBowlingRuns)} />
                  <StatCell label="Mdns"  value={stats.maidens} />
                  <StatCell
                    label="Overs"
                    value={`${Math.floor(stats.legalBallsBowled / 6)}${stats.legalBallsBowled % 6 > 0 ? `.${stats.legalBallsBowled % 6}` : ''}`}
                  />
                </div>
              </div>
            )}
          </div>

          {(!battingQualified || (hasBowling && !bowlingQualified)) && (
            <p className="text-muted/70 text-[11px] text-center">
              Averages and economy show after {MIN_QUALIFYING_INNINGS} innings.
            </p>
          )}

        </div>
      )}
    </Modal>
  );
}
