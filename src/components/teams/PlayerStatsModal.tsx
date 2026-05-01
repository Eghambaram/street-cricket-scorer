import { useEffect, useState } from 'react';
import { BarChart2, RotateCcw, AlertTriangle, TrendingUp, TrendingDown } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';
import { computeCareerStats, formatBestBowling } from '@/utils/playerStats';
import { useTeams } from '@/hooks/useTeams';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';
import type { CareerStats } from '@/utils/playerStats';

interface Props {
  isOpen: boolean;
  playerId: string;
  playerName: string;
  statsBaselineAt?: number;
  teamId?: string;
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

export function PlayerStatsModal({ isOpen, playerId, playerName, statsBaselineAt, teamId, onClose }: Props) {
  const [stats, setStats]           = useState<CareerStats | null>(null);
  const [loading, setLoading]       = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting]   = useState(false);

  const { resetPlayerStats, clearPlayerStats, teams } = useTeams();
  const { addToast } = useUIStore();

  // Resolve teamId from playerId if not passed
  const resolvedTeamId = teamId ?? teams.find((t) => t.players.some((p) => p.id === playerId))?.id;
  const hasBaseline = !!statsBaselineAt;

  useEffect(() => {
    if (!isOpen || !playerId) return;
    setLoading(true);
    setStats(null);
    setConfirmReset(false);
    computeCareerStats(playerId, statsBaselineAt)
      .then(setStats)
      .finally(() => setLoading(false));
  }, [isOpen, playerId, statsBaselineAt]);

  const handleResetStats = async () => {
    if (!resolvedTeamId) return;
    setResetting(true);
    try {
      await resetPlayerStats(resolvedTeamId, playerId);
      addToast(`${playerName} — new session started`, 'success');
      // Reload stats with the new baseline (now = today)
      const fresh = await computeCareerStats(playerId, Date.now());
      setStats(fresh);
      setConfirmReset(false);
    } catch {
      addToast('Failed to reset stats', 'error');
    } finally {
      setResetting(false);
    }
  };

  const handleClearStats = async () => {
    if (!resolvedTeamId) return;
    setResetting(true);
    try {
      await clearPlayerStats(resolvedTeamId, playerId);
      addToast(`${playerName} — showing all-time stats`, 'info');
      const fresh = await computeCareerStats(playerId, undefined);
      setStats(fresh);
      setConfirmReset(false);
    } catch {
      addToast('Failed to clear stats filter', 'error');
    } finally {
      setResetting(false);
    }
  };

  const sessionLabel = statsBaselineAt
    ? `Session from ${new Date(statsBaselineAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`
    : null;

  const hasBowling = stats && stats.bowlingInnings > 0;

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
            Play a match with this player to see their career stats here.
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
            {sessionLabel && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-safe/20 text-safe border border-safe/30">
                {sessionLabel}
              </span>
            )}
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
                  <StatCell label="Avg"   value={stats.battingAverage}   />
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
                  <StatCell label="Avg"   value={stats.wickets > 0 ? stats.bowlingAverage : '—'} />
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  <StatCell label="Econ"  value={stats.economy} />
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

          {/* ── Stats reset section ── */}
          {resolvedTeamId && (
            <div className="pt-1 border-t border-white/[0.07]">
              {!confirmReset ? (
                <button
                  onClick={() => setConfirmReset(true)}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                    hasBaseline
                      ? 'bg-safe/10 text-safe border border-safe/25 hover:bg-safe/18'
                      : 'bg-pitch text-muted border border-white/[0.08] hover:text-white hover:bg-pitch-light',
                  )}
                >
                  <RotateCcw size={14} className="shrink-0" />
                  <span className="text-left flex-1">
                    {hasBaseline ? 'Session active — reset or show all-time' : 'Start new session'}
                  </span>
                </button>
              ) : (
                <div className="bg-pitch rounded-xl border border-amber/30 p-4 space-y-3">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle size={16} className="text-amber shrink-0 mt-0.5" />
                    <div>
                      <p className="text-white text-sm font-bold leading-tight">Reset stats for {playerName}?</p>
                      <p className="text-muted text-xs mt-1 leading-relaxed">
                        Stats will count from today. Match history is never deleted.
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      fullWidth
                      onClick={() => setConfirmReset(false)}
                      disabled={resetting}
                    >
                      Cancel
                    </Button>
                    {hasBaseline && (
                      <Button
                        variant="secondary"
                        size="sm"
                        fullWidth
                        loading={resetting}
                        onClick={handleClearStats}
                      >
                        All-Time
                      </Button>
                    )}
                    <Button
                      variant="gold"
                      size="sm"
                      fullWidth
                      loading={resetting}
                      onClick={handleResetStats}
                    >
                      New Session
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      )}
    </Modal>
  );
}
