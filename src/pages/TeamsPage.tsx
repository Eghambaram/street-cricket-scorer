import { useEffect, useRef, useState, useCallback } from 'react';

import {
  Users, Plus, Trash2, ChevronDown, ChevronUp, Edit2, Check, X,
  Trophy, TrendingUp, TrendingDown, RotateCcw, Filter,
} from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { Spinner } from '@/components/common/Spinner';
import { PlayerStatsModal } from '@/components/teams/PlayerStatsModal';
import { useTeams } from '@/hooks/useTeams';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';
import { computeLeaderboard } from '@/utils/playerStats';
import type { LeaderboardEntry } from '@/utils/playerStats';
import type { SavedTeam, SavedPlayer, PlayerRole, SkillLevel } from '@/types/player.types';

export type PlayerRole_ = PlayerRole;

const ROLE_LABELS: Record<PlayerRole, string> = {
  batsman:      'BAT',
  bowler:       'BOWL',
  allrounder:   'AR',
  wicketkeeper: 'WK',
};

const ROLE_COLORS: Record<PlayerRole, string> = {
  batsman:      'bg-chip-bat/20 text-chip-bat border border-chip-bat/40',
  bowler:       'bg-chip-bow/20 text-chip-bow border border-chip-bow/40',
  allrounder:   'bg-chip-ar/20  text-chip-ar  border border-chip-ar/40',
  wicketkeeper: 'bg-chip-wk/20  text-chip-wk  border border-chip-wk/40',
};

const ROLE_ACTIVE: Record<PlayerRole, string> = {
  batsman:      'bg-chip-bat text-white',
  bowler:       'bg-chip-bow text-white',
  allrounder:   'bg-chip-ar  text-white',
  wicketkeeper: 'bg-chip-wk  text-white',
};

const ROLES: PlayerRole[] = ['batsman', 'bowler', 'allrounder', 'wicketkeeper'];
const SKILLS: SkillLevel[] = ['low', 'medium', 'high'];
const SKILL_LABELS: Record<SkillLevel, string> = { low: 'L', medium: 'M', high: 'H' };
const SKILL_COLORS: Record<SkillLevel, string> = {
  low: 'bg-muted/20 text-muted border border-white/10',
  medium: 'bg-amber/20 text-amber border border-amber/40',
  high: 'bg-safe/20 text-safe border border-safe/40',
};

const TIME_RANGES = [
  { label: 'This Week', days: 7 },
  { label: 'This Month', days: 30 },
  { label: '3 Months', days: 90 },
  { label: 'All Time', days: 0 },
] as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamsPage() {
  const { teams, loading, loadTeams, removeTeam } = useTeams();
  const { addToast } = useUIStore();

  const [activeTab, setActiveTab] = useState<'squads' | 'leaderboard'>('squads');
  const [viewingStatsPlayer, setViewingStatsPlayer] = useState<{
    id: string; name: string; baseline?: number; teamId?: string;
  } | null>(null);
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [showNewTeamModal, setShowNewTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [deleteTeamId, setDeleteTeamId] = useState<string | null>(null);

  const { createTeam } = useTeams();

  useEffect(() => { loadTeams(); }, [loadTeams]);

  const handleCreateTeam = async () => {
    if (!newTeamName.trim()) return;
    setCreatingTeam(true);
    try {
      const team = await createTeam(newTeamName);
      setShowNewTeamModal(false);
      setNewTeamName('');
      setExpandedTeamId(team.id);
    } catch {
      addToast('Failed to create team', 'error');
    } finally {
      setCreatingTeam(false);
    }
  };

  const handleDeleteTeam = async (id: string) => {
    try {
      await removeTeam(id);
      setDeleteTeamId(null);
      if (expandedTeamId === id) setExpandedTeamId(null);
      addToast('Team deleted', 'info');
    } catch {
      addToast('Failed to delete team', 'error');
    }
  };

  const totalPlayers = teams.reduce((s, t) => s + t.players.length, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-pitch flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-pitch flex flex-col">
      <TopBar
        title="Teams"
        showThemeToggle
        subtitle={
          teams.length > 0
            ? `${teams.length} team${teams.length !== 1 ? 's' : ''} · ${totalPlayers} player${totalPlayers !== 1 ? 's' : ''}`
            : undefined
        }
        actions={
          activeTab === 'squads' ? (
            <button
              onClick={() => setShowNewTeamModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gold/20 text-gold text-sm font-bold hover:bg-gold/30 transition-colors min-h-[36px]"
            >
              <Plus size={16} /> New Team
            </button>
          ) : undefined
        }
      />

      {/* ── Summary strip (when teams exist) ── */}
      {teams.length > 0 && (
        <div className="shrink-0 flex gap-0 border-b border-white/[0.06]">
          <SummaryPill value={teams.length} label="Teams" />
          <SummaryPill value={totalPlayers} label="Players" />
          <SummaryPill
            value={teams.reduce((s, t) => s + t.players.filter((p) => !!p.statsBaselineAt).length, 0) > 0 ? 'Active' : '—'}
            label="Tournament"
            accent
          />
        </div>
      )}

      {/* ── Tab bar ── */}
      <div className="shrink-0 flex gap-1 px-4 pt-3 pb-0">
        <TabPill
          label="Squads"
          icon={<Users size={15} />}
          active={activeTab === 'squads'}
          onClick={() => setActiveTab('squads')}
        />
        <TabPill
          label="Leaderboard"
          icon={<Trophy size={15} />}
          active={activeTab === 'leaderboard'}
          onClick={() => setActiveTab('leaderboard')}
        />
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-h-0">
        {activeTab === 'squads' ? (
          <div className="px-4 py-4 space-y-3 pb-28">
            {teams.length === 0 ? (
              <EmptyState onNew={() => setShowNewTeamModal(true)} />
            ) : (
              teams.map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                  isExpanded={expandedTeamId === team.id}
                  onToggle={() => setExpandedTeamId(expandedTeamId === team.id ? null : team.id)}
                  onDeleteTeam={() => setDeleteTeamId(team.id)}
                  onViewStats={(p) => setViewingStatsPlayer({
                    id: p.id,
                    name: p.name,
                    baseline: p.statsBaselineAt ?? team.statsBaselineAt,
                    teamId: team.id,
                  })}
                />
              ))
            )}
          </div>
        ) : (
          <LeaderboardTab
            teams={teams}
            onViewStats={(id, name, baseline, teamId) =>
              setViewingStatsPlayer({ id, name, baseline, teamId })
            }
          />
        )}
      </div>

      {/* New Team Modal */}
      <Modal
        isOpen={showNewTeamModal}
        onClose={() => { setShowNewTeamModal(false); setNewTeamName(''); }}
        title="New Team"
      >
        <div className="space-y-4">
          <input
            autoFocus
            value={newTeamName}
            onChange={(e) => setNewTeamName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleCreateTeam()}
            placeholder="e.g. Street Lions"
            className="w-full bg-pitch border border-pitch-light rounded-xl px-4 py-3 text-white placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-gold/50"
          />
          <div className="flex gap-3">
            <Button variant="secondary" size="lg" fullWidth
              onClick={() => { setShowNewTeamModal(false); setNewTeamName(''); }}>
              Cancel
            </Button>
            <Button variant="gold" size="lg" fullWidth loading={creatingTeam}
              disabled={!newTeamName.trim()} onClick={handleCreateTeam}>
              Create Team
            </Button>
          </div>
        </div>
      </Modal>

      {/* Player Stats Modal */}
      {viewingStatsPlayer && (
        <PlayerStatsModal
          isOpen
          playerId={viewingStatsPlayer.id}
          playerName={viewingStatsPlayer.name}
          statsBaselineAt={viewingStatsPlayer.baseline}
          teamId={viewingStatsPlayer.teamId}
          onClose={() => setViewingStatsPlayer(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      <Modal isOpen={!!deleteTeamId} onClose={() => setDeleteTeamId(null)} title="Delete Team?">
        <p className="text-muted text-sm text-center mb-6">
          This removes the saved team roster. Your match history is not affected.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" size="lg" fullWidth onClick={() => setDeleteTeamId(null)}>
            Cancel
          </Button>
          <Button variant="danger" size="lg" fullWidth
            onClick={() => deleteTeamId && handleDeleteTeam(deleteTeamId)}>
            Delete Team
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ─── SummaryPill ──────────────────────────────────────────────────────────────

function SummaryPill({ value, label, accent }: { value: string | number; label: string; accent?: boolean }) {
  return (
    <div className="flex-1 flex flex-col items-center py-2.5 border-r border-white/[0.06] last:border-r-0">
      <span className={cn('text-lg font-black leading-none', accent ? 'text-safe' : 'text-white')}>
        {value}
      </span>
      <span className="text-[10px] text-muted font-semibold uppercase tracking-wider mt-0.5">{label}</span>
    </div>
  );
}

// ─── TabPill ──────────────────────────────────────────────────────────────────

function TabPill({ label, icon, active, onClick }: {
  label: string; icon: React.ReactNode; active: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold transition-all',
        active ? 'bg-gold text-pitch-dark shadow-sm' : 'text-muted hover:text-white hover:bg-pitch-light',
      )}
    >
      {icon}{label}
    </button>
  );
}

// ─── LeaderboardTab ───────────────────────────────────────────────────────────

function LeaderboardTab({
  teams,
  onViewStats,
}: {
  teams: SavedTeam[];
  onViewStats: (id: string, name: string, baseline?: number, teamId?: string) => void;
}) {
  const [rangeIdx, setRangeIdx] = useState(2);
  const [mode, setMode] = useState<'batting' | 'bowling'>('batting');
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loadingLb, setLoadingLb] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const { resetTeamStats, clearTeamStats } = useTeams();
  const { addToast } = useUIStore();

  const selectedTeam = selectedTeamId ? teams.find((t) => t.id === selectedTeamId) ?? null : null;
  const tournamentActive = selectedTeam
    ? selectedTeam.players.some((p) => !!p.statsBaselineAt)
    : false;

  const filteredTeams = selectedTeamId ? teams.filter((t) => t.id === selectedTeamId) : teams;

  const allPlayers = filteredTeams.flatMap((t) =>
    t.players.map((p) => ({
      playerId: p.id,
      playerName: p.name,
      teamName: t.name,
      teamId: t.id,
      statsBaselineAt: p.statsBaselineAt ?? t.statsBaselineAt,
    })),
  );

  const load = useCallback(async () => {
    if (allPlayers.length === 0) { setEntries([]); return; }
    setLoadingLb(true);
    const days = TIME_RANGES[rangeIdx].days;
    const since = days > 0 ? Date.now() - days * 86_400_000 : undefined;
    try {
      const result = await computeLeaderboard(allPlayers, since);
      setEntries(result);
    } finally {
      setLoadingLb(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rangeIdx, selectedTeamId, teams]);

  useEffect(() => { load(); }, [load]);

  const handleStartTournament = async () => {
    if (!selectedTeamId || !selectedTeam) return;
    try {
      await resetTeamStats(selectedTeamId);
      addToast(`${selectedTeam.name} — new tournament started! 🏆`, 'success');
      setShowResetConfirm(false);
      load();
    } catch {
      addToast('Failed to reset', 'error');
    }
  };

  const handleShowAllTime = async () => {
    if (!selectedTeamId || !selectedTeam) return;
    try {
      await clearTeamStats(selectedTeamId);
      addToast('Showing all-time stats', 'info');
      setShowResetConfirm(false);
      load();
    } catch {
      addToast('Failed to clear', 'error');
    }
  };

  const totalPlayers = teams.reduce((s, t) => s + t.players.length, 0);
  if (totalPlayers === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-3 px-6">
        <Trophy size={48} className="text-muted/40" />
        <p className="text-white font-bold">No players yet</p>
        <p className="text-muted text-sm">Add players to your squads to see the leaderboard.</p>
      </div>
    );
  }

  const sorted = [...entries].sort((a, b) => {
    if (mode === 'batting') {
      if (b.stats.totalRuns !== a.stats.totalRuns) return b.stats.totalRuns - a.stats.totalRuns;
      return b.stats.battingAverage - a.stats.battingAverage;
    } else {
      if (b.stats.wickets !== a.stats.wickets) return b.stats.wickets - a.stats.wickets;
      if (a.stats.economy === 0 && b.stats.economy === 0) return 0;
      if (a.stats.economy === 0) return 1;
      if (b.stats.economy === 0) return -1;
      return a.stats.economy - b.stats.economy;
    }
  });

  const hasAnyData = sorted.some((e) =>
    mode === 'batting' ? e.stats.battingInnings > 0 : e.stats.bowlingInnings > 0,
  );

  const globalTournamentActive = allPlayers.some((p) => p.statsBaselineAt);

  return (
    <div className="pb-28">

      {/* ── Team filter chips (only when multiple teams) ── */}
      {teams.length > 1 && (
        <div className="flex gap-2 px-4 pt-3 pb-1 overflow-x-auto no-scrollbar">
          <button
            onClick={() => { setSelectedTeamId(null); setShowResetConfirm(false); }}
            className={cn(
              'shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all',
              !selectedTeamId
                ? 'bg-gold text-pitch-dark shadow-sm'
                : 'bg-pitch-light text-muted hover:text-white',
            )}
          >
            <Users size={11} />All Teams
          </button>
          {teams.map((t) => {
            const isActive = selectedTeamId === t.id;
            const hasTournament = t.players.some((p) => !!p.statsBaselineAt);
            return (
              <button
                key={t.id}
                onClick={() => { setSelectedTeamId(isActive ? null : t.id); setShowResetConfirm(false); }}
                className={cn(
                  'shrink-0 flex items-center gap-1 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all',
                  isActive
                    ? 'bg-gold text-pitch-dark shadow-sm'
                    : 'bg-pitch-light text-muted hover:text-white',
                )}
              >
                {t.name}
                {hasTournament && <span className="opacity-80">🏆</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Time range chips ── */}
      <div className={cn('flex gap-2 px-4 overflow-x-auto no-scrollbar pb-2', teams.length > 1 ? 'pt-2' : 'pt-3')}>
        {TIME_RANGES.map((r, i) => (
          <button
            key={r.label}
            onClick={() => setRangeIdx(i)}
            className={cn(
              'shrink-0 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all',
              rangeIdx === i
                ? 'bg-gold/20 text-gold border border-gold/40'
                : 'bg-pitch-light text-muted hover:text-white',
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      {/* ── Batting / Bowling toggle ── */}
      <div className="flex mx-4 mb-3 bg-pitch-light rounded-xl p-1">
        <button
          onClick={() => setMode('batting')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition-all',
            mode === 'batting' ? 'bg-runs/90 text-pitch-dark' : 'text-muted',
          )}
        >
          <TrendingUp size={15} /> Batting
        </button>
        <button
          onClick={() => setMode('bowling')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-bold transition-all',
            mode === 'bowling' ? 'bg-amber/90 text-pitch-dark' : 'text-muted',
          )}
        >
          <TrendingDown size={15} /> Bowling
        </button>
      </div>

      {/* ── Per-team tournament / reset section ── */}
      {selectedTeam && (
        <div className="mx-4 mb-3">
          {!showResetConfirm ? (
            <button
              onClick={() => setShowResetConfirm(true)}
              className={cn(
                'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                tournamentActive
                  ? 'bg-safe/15 text-safe border border-safe/30 hover:bg-safe/20'
                  : 'bg-pitch-light text-muted hover:text-white border border-dashed border-white/10',
              )}
            >
              <RotateCcw size={14} className="shrink-0" />
              <div className="text-left">
                <p className="leading-tight">
                  {tournamentActive
                    ? `${selectedTeam.name} — Tournament in progress`
                    : `New Tournament for ${selectedTeam.name}`}
                </p>
                <p className="text-[10px] font-normal opacity-70 leading-tight">
                  {tournamentActive
                    ? 'Tap to reset stats for a new tournament'
                    : 'Reset stats to track this tournament only'}
                </p>
              </div>
            </button>
          ) : (
            <div className="bg-pitch rounded-xl border border-safe/30 px-4 py-3 space-y-2.5">
              <p className="text-white text-sm font-bold">New tournament for {selectedTeam.name}?</p>
              <p className="text-muted text-xs leading-relaxed">
                Stats will count from today. Full match history is never deleted.
              </p>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" fullWidth onClick={() => setShowResetConfirm(false)}>
                  Cancel
                </Button>
                {tournamentActive && (
                  <Button variant="secondary" size="sm" fullWidth onClick={handleShowAllTime}>
                    All-Time
                  </Button>
                )}
                <Button variant="gold" size="sm" fullWidth onClick={handleStartTournament}>
                  🏆 Start
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Global tournament notice when no team selected ── */}
      {!selectedTeam && globalTournamentActive && (
        <div className="mx-4 mb-3 flex items-center gap-2 px-3 py-2 rounded-xl bg-safe/15 border border-safe/30">
          <Trophy size={13} className="text-safe shrink-0" />
          <p className="text-safe text-xs font-semibold">
            {teams.length > 1
              ? 'Some teams have tournament stats active · Filter by team to manage'
              : 'Tournament stats active · Go to Squads to manage'}
          </p>
        </div>
      )}

      {loadingLb ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : !hasAnyData ? (
        <NoDataState mode={mode} range={TIME_RANGES[rangeIdx].label} />
      ) : (
        <>
          <Podium entries={sorted} mode={mode} onViewStats={onViewStats} />
          <div className="px-4 mt-4 space-y-2">
            <div className="flex items-center justify-between mb-3">
              <p className="text-muted text-[11px] font-bold uppercase tracking-wider">
                {selectedTeam ? selectedTeam.name : 'All Players'}
              </p>
              {selectedTeam && (
                <div className="flex items-center gap-1 text-muted/60 text-[10px]">
                  <Filter size={10} />
                  <span>{selectedTeam.players.length} players</span>
                </div>
              )}
            </div>
            {sorted.map((entry, idx) => (
              <RankRow
                key={entry.playerId}
                rank={idx + 1}
                entry={entry}
                mode={mode}
                onViewStats={() => onViewStats(
                  entry.playerId,
                  entry.playerName,
                  entry.statsBaselineAt,
                  (entry as LeaderboardEntry & { teamId?: string }).teamId,
                )}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Podium ───────────────────────────────────────────────────────────────────

function Podium({
  entries,
  mode,
  onViewStats,
}: {
  entries: LeaderboardEntry[];
  mode: 'batting' | 'bowling';
  onViewStats: (id: string, name: string, baseline?: number, teamId?: string) => void;
}) {
  const active = entries.filter((e) =>
    mode === 'batting' ? e.stats.battingInnings > 0 : e.stats.bowlingInnings > 0,
  );
  if (active.length === 0) return null;

  const [first, second, third] = active;
  const primaryStat = (e: LeaderboardEntry) => mode === 'batting' ? e.stats.totalRuns : e.stats.wickets;
  const primaryLabel = mode === 'batting' ? 'Runs' : 'Wickets';
  const secondaryStat = (e: LeaderboardEntry) =>
    mode === 'batting'
      ? `Avg ${e.stats.battingAverage}`
      : e.stats.economy > 0 ? `Econ ${e.stats.economy}` : '—';

  const teamId = (e: LeaderboardEntry) => (e as LeaderboardEntry & { teamId?: string }).teamId;

  return (
    <div className="mx-4 mt-2">
      {first && (
        <button
          onClick={() => onViewStats(first.playerId, first.playerName, first.statsBaselineAt, teamId(first))}
          className="w-full rounded-2xl overflow-hidden mb-3 text-left active:scale-[0.98] transition-transform"
        >
          <div className="relative bg-gradient-to-br from-gold/30 via-gold/15 to-transparent border border-gold/40 rounded-2xl px-5 py-4">
            {/* Shimmer accent line at top */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent rounded-t-2xl" />
            <div className="absolute top-4 right-4 text-2xl select-none">👑</div>
            <div className="flex items-center gap-3 mb-3">
              <div className="relative">
                <PlayerAvatar name={first.playerName} size="lg" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-gold flex items-center justify-center text-[10px] font-black text-pitch-dark border-2 border-pitch">
                  1
                </div>
              </div>
              <div className="min-w-0">
                <p className="font-bold text-white text-lg leading-tight truncate">{first.playerName}</p>
                <p className="text-gold text-xs font-semibold">{first.teamName}</p>
              </div>
            </div>
            <div className="flex items-end gap-4">
              <div>
                <p className="font-display text-5xl text-gold leading-none">{primaryStat(first)}</p>
                <p className="text-gold/70 text-xs mt-0.5 font-semibold uppercase tracking-wide">{primaryLabel}</p>
              </div>
              <div className="mb-1 flex gap-3">
                {mode === 'batting' ? (
                  <>
                    <MiniStat label="SR" value={first.stats.strikeRate} />
                    <MiniStat label="HS" value={first.stats.highScore} />
                    <MiniStat label="6s" value={first.stats.sixes} />
                  </>
                ) : (
                  <>
                    <MiniStat label="Econ" value={first.stats.economy > 0 ? first.stats.economy : '—'} />
                    <MiniStat label="Best" value={first.stats.bestBowlingWickets > 0 ? `${first.stats.bestBowlingWickets}/${first.stats.bestBowlingRuns}` : '—'} />
                    <MiniStat label="Mdns" value={first.stats.maidens} />
                  </>
                )}
              </div>
            </div>
            <p className="text-gold/50 text-[10px] mt-2 font-semibold">
              {first.stats.matches} match{first.stats.matches !== 1 ? 'es' : ''} · {first.stats.battingInnings} inn
            </p>
          </div>
        </button>
      )}

      {(second || third) && (
        <div className="grid grid-cols-2 gap-3 mb-1">
          {[{ entry: second, rank: 2 }, { entry: third, rank: 3 }].map(({ entry: e, rank }) =>
            e ? (
              <button
                key={e.playerId}
                onClick={() => onViewStats(e.playerId, e.playerName, e.statsBaselineAt, teamId(e))}
                className="rounded-2xl text-left active:scale-[0.97] transition-transform"
              >
                <div className="h-full relative rounded-2xl px-4 py-3.5 border bg-pitch-light border-white/10 overflow-hidden">
                  <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent" />
                  <div className="flex items-center gap-2 mb-2">
                    <div className="relative">
                      <PlayerAvatar name={e.playerName} size="sm" />
                      <div className={cn(
                        'absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-black border-2 border-pitch',
                        rank === 2 ? 'bg-white/70 text-pitch-dark' : 'bg-amber/70 text-pitch-dark',
                      )}>
                        {rank}
                      </div>
                    </div>
                    <p className="font-bold text-white text-sm leading-tight truncate">{e.playerName}</p>
                  </div>
                  <p className={cn('font-display text-3xl leading-none', rank === 2 ? 'text-white/90' : 'text-white/70')}>
                    {primaryStat(e)}
                  </p>
                  <p className="text-muted text-[10px] mt-0.5 font-semibold uppercase tracking-wide">{primaryLabel}</p>
                  <p className="text-muted text-[10px] mt-1">{secondaryStat(e)}</p>
                </div>
              </button>
            ) : (
              <div key={`empty-${rank}`} className="rounded-2xl bg-pitch-light/30 border border-dashed border-white/10 flex items-center justify-center min-h-[100px]">
                <p className="text-muted/40 text-xs">#{rank}</p>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}

// ─── RankRow ──────────────────────────────────────────────────────────────────

function RankRow({ rank, entry, mode, onViewStats }: {
  rank: number;
  entry: LeaderboardEntry;
  mode: 'batting' | 'bowling';
  onViewStats: () => void;
}) {
  const hasData = mode === 'batting' ? entry.stats.battingInnings > 0 : entry.stats.bowlingInnings > 0;

  return (
    <button
      onClick={onViewStats}
      className={cn(
        'w-full flex items-center gap-3 px-3.5 py-3 rounded-2xl text-left transition-all active:scale-[0.98]',
        hasData ? 'bg-pitch-light hover:bg-pitch-light/80' : 'bg-pitch-light/40',
        rank <= 3 && hasData && 'border border-gold/20',
      )}
    >
      <span className={cn(
        'w-7 text-center text-sm font-black shrink-0',
        rank === 1 ? 'text-gold' : rank === 2 ? 'text-white/70' : rank === 3 ? 'text-amber' : 'text-muted/60',
      )}>
        {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : rank}
      </span>
      <PlayerAvatar name={entry.playerName} size="xs" />
      <div className="flex-1 min-w-0">
        <p className="text-white text-sm font-bold truncate leading-tight">{entry.playerName}</p>
        <p className="text-muted text-[10px] truncate">{entry.teamName}</p>
      </div>
      {hasData ? (
        mode === 'batting' ? (
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-white font-bold text-base leading-tight">{entry.stats.totalRuns}</p>
              <p className="text-muted text-[10px]">runs</p>
            </div>
            <div className="text-right">
              <p className="text-muted text-xs font-semibold leading-tight">{entry.stats.strikeRate}</p>
              <p className="text-muted/60 text-[10px]">SR</p>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <p className="text-white font-bold text-base leading-tight">{entry.stats.wickets}</p>
              <p className="text-muted text-[10px]">wkts</p>
            </div>
            <div className="text-right">
              <p className="text-muted text-xs font-semibold leading-tight">
                {entry.stats.economy > 0 ? entry.stats.economy : '—'}
              </p>
              <p className="text-muted/60 text-[10px]">econ</p>
            </div>
          </div>
        )
      ) : (
        <span className="text-muted/40 text-xs shrink-0">No data</span>
      )}
    </button>
  );
}

// ─── PlayerAvatar ─────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-chip-bat/25 text-chip-bat',
  'bg-chip-ar/25  text-chip-ar',
  'bg-chip-wk/25  text-chip-wk',
  'bg-chip-bow/25 text-chip-bow',
  'bg-chip-ex1/25 text-chip-ex1',
  'bg-chip-ex2/25 text-chip-ex2',
];

function nameColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function PlayerAvatar({ name, size = 'sm' }: { name: string; size?: 'xs' | 'sm' | 'lg' }) {
  const cls = size === 'lg' ? 'w-12 h-12 text-lg' : size === 'sm' ? 'w-9 h-9 text-sm' : 'w-7 h-7 text-xs';
  return (
    <div className={cn('rounded-full flex items-center justify-center font-black shrink-0', cls, nameColor(name))}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

// ─── MiniStat ─────────────────────────────────────────────────────────────────

function MiniStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="text-center">
      <p className="text-white/90 text-sm font-bold leading-tight">{value}</p>
      <p className="text-gold/60 text-[10px] leading-none">{label}</p>
    </div>
  );
}

// ─── NoDataState ──────────────────────────────────────────────────────────────

function NoDataState({ mode, range }: { mode: 'batting' | 'bowling'; range: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center space-y-3 px-8">
      <span className="text-5xl select-none">{mode === 'batting' ? '🏏' : '🎳'}</span>
      <p className="text-white font-bold">No {mode} data yet</p>
      <p className="text-muted text-sm">
        Play some matches in the <span className="text-white font-semibold">{range}</span> period to see rankings.
      </p>
    </div>
  );
}

// ─── TeamCard ─────────────────────────────────────────────────────────────────

interface TeamCardProps {
  team: SavedTeam;
  isExpanded: boolean;
  onToggle: () => void;
  onDeleteTeam: () => void;
  onViewStats: (player: SavedPlayer) => void;
}

function TeamCard({ team, isExpanded, onToggle, onDeleteTeam, onViewStats }: TeamCardProps) {
  const { updateTeam, addPlayer, removePlayer, updatePlayer, resetTeamStats, clearTeamStats } = useTeams();
  const { addToast } = useUIStore();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isExpanded)
      setTimeout(() => cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 150);
  }, [isExpanded]);

  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const [addingPlayer, setAddingPlayer] = useState(false);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [newPlayerRole, setNewPlayerRole] = useState<PlayerRole | undefined>(undefined);
  const [newPlayerSkill, setNewPlayerSkill] = useState<SkillLevel>('medium');
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null);
  const [editPlayerName, setEditPlayerName] = useState('');
  const [editPlayerRole, setEditPlayerRole] = useState<PlayerRole | undefined>(undefined);
  const [editPlayerSkill, setEditPlayerSkill] = useState<SkillLevel>('medium');
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const pendingDeleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [showTournamentReset, setShowTournamentReset] = useState(false);

  const isDupeName = (name: string, excludeId?: string) =>
    team.players.some((p) => p.id !== excludeId && p.name.trim().toLowerCase() === name.trim().toLowerCase());

  const handleSaveName = async () => {
    if (!editNameValue.trim()) return;
    try {
      await updateTeam({ ...team, name: editNameValue.trim() });
      setEditingName(false);
      addToast('Team name updated', 'success');
    } catch {
      addToast('Failed to update team name', 'error');
    }
  };

  const handleAddPlayer = async () => {
    if (!newPlayerName.trim()) return;
    if (team.players.length >= 50) { addToast('Maximum 50 players per team', 'warning'); return; }
    if (isDupeName(newPlayerName)) { addToast(`${newPlayerName.trim()} is already in this team`, 'warning'); return; }
    try {
      await addPlayer(team.id, newPlayerName, newPlayerRole, newPlayerSkill);
      addToast(`${newPlayerName.trim()} added`, 'success');
      setNewPlayerName('');
      setNewPlayerRole(undefined);
      setNewPlayerSkill('medium');
      setAddingPlayer(false);
    } catch {
      addToast('Failed to add player', 'error');
    }
  };

  const handleSavePlayer = async (playerId: string) => {
    if (!editPlayerName.trim()) return;
    if (isDupeName(editPlayerName, playerId)) { addToast(`${editPlayerName.trim()} is already in this team`, 'warning'); return; }
    try {
      await updatePlayer(team.id, playerId, { name: editPlayerName.trim(), role: editPlayerRole, skillLevel: editPlayerSkill });
      setEditingPlayerId(null);
    } catch {
      addToast('Failed to update player', 'error');
    }
  };

  const handleRemovePlayer = (playerId: string) => {
    if (team.players.length <= 2) { addToast('Minimum 2 players required', 'warning'); return; }
    if (pendingDeleteId === playerId) {
      if (pendingDeleteTimer.current) clearTimeout(pendingDeleteTimer.current);
      setPendingDeleteId(null);
      removePlayer(team.id, playerId).catch(() => addToast('Failed to remove player', 'error'));
    } else {
      if (pendingDeleteTimer.current) clearTimeout(pendingDeleteTimer.current);
      setPendingDeleteId(playerId);
      pendingDeleteTimer.current = setTimeout(() => setPendingDeleteId(null), 3000);
    }
  };

  const handleStartTournament = async () => {
    try {
      await resetTeamStats(team.id);
      addToast(`${team.name} — new tournament started! 🏆`, 'success');
      setShowTournamentReset(false);
    } catch {
      addToast('Failed to reset', 'error');
    }
  };

  const handleShowAllTime = async () => {
    try {
      await clearTeamStats(team.id);
      addToast('Showing all-time stats', 'info');
      setShowTournamentReset(false);
    } catch {
      addToast('Failed to clear', 'error');
    }
  };

  const tournamentActive = team.players.some((p) => !!p.statsBaselineAt);
  const tournamentDate = tournamentActive
    ? team.players.find((p) => p.statsBaselineAt)?.statsBaselineAt
    : null;

  const roleCounts = team.players.reduce<Record<string, number>>((acc, p) => {
    const r = p.role ?? 'unassigned';
    acc[r] = (acc[r] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div
      ref={cardRef}
      className={cn(
        'rounded-2xl overflow-hidden transition-all',
        isExpanded
          ? 'bg-pitch-light ring-1 ring-gold/25 shadow-[0_0_20px_0_rgb(var(--color-gold)/0.08)]'
          : 'bg-pitch-light',
      )}
    >
      {/* ── Header row ── */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className={cn(
          'w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-all',
          isExpanded ? 'bg-gold/30' : 'bg-gold/15',
        )}>
          <Users size={18} className={isExpanded ? 'text-gold' : 'text-gold/70'} />
        </div>

        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-2">
              <input
                autoFocus
                value={editNameValue}
                onChange={(e) => setEditNameValue(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSaveName(); if (e.key === 'Escape') setEditingName(false); }}
                className="flex-1 bg-pitch border border-pitch-light rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
              />
              <button onClick={handleSaveName} className="text-gold p-1 min-w-[32px] min-h-[32px] flex items-center justify-center"><Check size={16} /></button>
              <button onClick={() => setEditingName(false)} className="text-muted p-1 min-w-[32px] min-h-[32px] flex items-center justify-center"><X size={16} /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="font-bold text-white truncate">{team.name}</span>
              <button onClick={() => { setEditingName(true); setEditNameValue(team.name); }}
                className="text-muted hover:text-gold p-1 shrink-0 transition-colors">
                <Edit2 size={13} />
              </button>
            </div>
          )}
          {/* Player count + role pills */}
          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
            <span className="text-xs text-muted">{team.players.length} player{team.players.length !== 1 ? 's' : ''}</span>
            {(Object.entries(roleCounts) as [string, number][])
              .filter(([r]) => r !== 'unassigned')
              .map(([role, count]) => (
                <span key={role} className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', ROLE_COLORS[role as PlayerRole])}>
                  {count} {ROLE_LABELS[role as PlayerRole]}
                </span>
              ))}
            {tournamentActive && tournamentDate && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-safe/20 text-safe border border-safe/30">
                🏆 From {new Date(tournamentDate).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
              </span>
            )}
          </div>
        </div>

        <button onClick={onDeleteTeam}
          className="text-muted hover:text-wicket p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-wicket/10 transition-colors">
          <Trash2 size={16} />
        </button>
        <button onClick={onToggle}
          className="text-muted hover:text-white p-2 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-pitch/50 transition-colors">
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {/* ── Expanded content ── */}
      {isExpanded && (
        <div className="border-t border-pitch/60 px-4 pt-3 pb-4 space-y-1.5">
          {team.players.length === 0 && !addingPlayer && (
            <p className="text-muted text-sm text-center py-3">No players yet — add your first player below.</p>
          )}

          {team.players.map((player, idx) => (
            <PlayerRow
              key={player.id}
              player={player}
              index={idx}
              isEditing={editingPlayerId === player.id}
              editName={editPlayerName}
              editRole={editPlayerRole}
              editSkill={editPlayerSkill}
              pendingDelete={pendingDeleteId === player.id}
              onStartEdit={() => { setEditingPlayerId(player.id); setEditPlayerName(player.name); setEditPlayerRole(player.role); setEditPlayerSkill(player.skillLevel ?? 'medium'); }}
              onChangeName={setEditPlayerName}
              onChangeRole={setEditPlayerRole}
              onChangeSkill={setEditPlayerSkill}
              onSave={() => handleSavePlayer(player.id)}
              onCancel={() => setEditingPlayerId(null)}
              onRemove={() => handleRemovePlayer(player.id)}
              canRemove={team.players.length > 2}
              onViewStats={() => onViewStats(player)}
            />
          ))}

          {/* Add player form */}
          {addingPlayer ? (
            <div className="space-y-2 pt-1 bg-pitch rounded-xl p-3">
              <input
                autoFocus
                value={newPlayerName}
                onChange={(e) => setNewPlayerName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddPlayer(); if (e.key === 'Escape') setAddingPlayer(false); }}
                placeholder="Player name"
                className="w-full bg-pitch-light border border-pitch rounded-xl px-3 py-2.5 text-white placeholder-muted/50 text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
              />
              <div className="flex gap-1.5 flex-wrap">
                {ROLES.map((r) => (
                  <button key={r}
                    onClick={() => setNewPlayerRole(newPlayerRole === r ? undefined : r)}
                    className={cn('px-2.5 py-1 rounded-lg text-xs font-bold transition-colors',
                      newPlayerRole === r ? ROLE_ACTIVE[r] : 'bg-pitch-light text-muted hover:text-white')}>
                    {ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {SKILLS.map((lv) => (
                  <button key={lv} onClick={() => setNewPlayerSkill(lv)} className={cn('px-2.5 py-1 rounded-lg text-xs font-bold transition-colors', newPlayerSkill === lv ? SKILL_COLORS[lv] : 'bg-pitch-light text-muted hover:text-white')}>
                    Skill {SKILL_LABELS[lv]}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" fullWidth
                  onClick={() => { setAddingPlayer(false); setNewPlayerName(''); setNewPlayerRole(undefined); }}>
                  Cancel
                </Button>
                <Button variant="gold" size="sm" fullWidth disabled={!newPlayerName.trim()} onClick={handleAddPlayer}>
                  Add
                </Button>
              </div>
            </div>
          ) : (
            team.players.length < 50 && (
              <button
                onClick={() => setAddingPlayer(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-gold/30 text-gold text-sm font-semibold hover:bg-gold/10 transition-colors mt-1"
              >
                <Plus size={16} /> Add Player
                <span className="text-gold/40 text-xs font-normal">({team.players.length}/50)</span>
              </button>
            )
          )}

          {team.players.length >= 50 && (
            <p className="text-muted text-xs text-center pt-1">Maximum 50 players reached</p>
          )}

          {/* Tournament / Stats Reset section */}
          {team.players.length > 0 && (
            <div className="mt-3 pt-3 border-t border-pitch/60">
              {!showTournamentReset ? (
                <button
                  onClick={() => setShowTournamentReset(true)}
                  className={cn(
                    'w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-semibold transition-colors',
                    tournamentActive
                      ? 'bg-safe/15 text-safe border border-safe/30 hover:bg-safe/20'
                      : 'bg-pitch text-muted hover:text-white hover:bg-pitch-light border border-dashed border-white/10',
                  )}
                >
                  <RotateCcw size={14} className="shrink-0" />
                  <div className="text-left">
                    <p className="leading-tight">
                      {tournamentActive ? 'Tournament in progress' : 'New Tournament'}
                    </p>
                    <p className="text-[10px] font-normal opacity-70 leading-tight">
                      {tournamentActive
                        ? 'Tap to reset stats for a new tournament'
                        : 'Reset stats to track this tournament only'}
                    </p>
                  </div>
                </button>
              ) : (
                <div className="bg-pitch rounded-xl border border-safe/30 px-4 py-3 space-y-2.5">
                  <p className="text-white text-sm font-bold">New tournament for {team.name}?</p>
                  <p className="text-muted text-xs leading-relaxed">
                    Stats on the Leaderboard will count from today. Your full match history is never deleted and you can switch back any time.
                  </p>
                  <div className="flex gap-2 flex-wrap">
                    <Button variant="secondary" size="sm" fullWidth onClick={() => setShowTournamentReset(false)}>
                      Cancel
                    </Button>
                    {tournamentActive && (
                      <Button variant="secondary" size="sm" fullWidth onClick={handleShowAllTime}>
                        Show All-Time
                      </Button>
                    )}
                    <Button variant="gold" size="sm" fullWidth onClick={handleStartTournament}>
                      🏆 Start Tournament
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── PlayerRow ────────────────────────────────────────────────────────────────

interface PlayerRowProps {
  player: SavedPlayer;
  index: number;
  isEditing: boolean;
  editName: string;
  editRole: PlayerRole | undefined;
  editSkill: SkillLevel;
  pendingDelete: boolean;
  onStartEdit: () => void;
  onChangeName: (v: string) => void;
  onChangeRole: (r: PlayerRole | undefined) => void;
  onChangeSkill: (s: SkillLevel) => void;
  onSave: () => void;
  onCancel: () => void;
  onRemove: () => void;
  canRemove: boolean;
  onViewStats: () => void;
}

function PlayerRow({
  player, index, isEditing, editName, editRole, editSkill, pendingDelete,
  onStartEdit, onChangeName, onChangeRole, onChangeSkill, onSave, onCancel, onRemove, canRemove, onViewStats,
}: PlayerRowProps) {
  if (isEditing) {
    return (
      <div className="space-y-2 bg-pitch rounded-xl p-3">
        <input
          autoFocus
          value={editName}
          onChange={(e) => onChangeName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
          className="w-full bg-pitch-light border border-pitch rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-gold/50"
        />
        <div className="flex gap-1.5 flex-wrap">
          {ROLES.map((r) => (
            <button key={r}
              onClick={() => onChangeRole(editRole === r ? undefined : r)}
              className={cn('px-2.5 py-1 rounded-lg text-xs font-bold transition-colors',
                editRole === r ? ROLE_ACTIVE[r] : 'bg-pitch-light text-muted hover:text-white')}>
              {ROLE_LABELS[r]}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {SKILLS.map((lv) => (
            <button key={lv} onClick={() => onChangeSkill(lv)} className={cn('px-2.5 py-1 rounded-lg text-xs font-bold transition-colors', editSkill === lv ? SKILL_COLORS[lv] : 'bg-pitch-light text-muted hover:text-white')}>
              Skill {SKILL_LABELS[lv]}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" fullWidth onClick={onCancel}>Cancel</Button>
          <Button variant="gold" size="sm" fullWidth disabled={!editName.trim()} onClick={onSave}>Save</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-2 py-1.5 px-2 rounded-xl transition-colors', pendingDelete && 'bg-wicket/10')}>
      <span className="text-muted text-xs w-5 text-right shrink-0">{index + 1}.</span>
      <button onClick={onViewStats} className="flex items-center gap-2 flex-1 min-w-0 text-left hover:text-gold transition-colors">
        <PlayerAvatar name={player.name} size="xs" />
        <span className="text-white text-sm truncate">{player.name}</span>
      </button>
      {player.skillLevel && (
        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0', SKILL_COLORS[player.skillLevel])}>
          {SKILL_LABELS[player.skillLevel]}
        </span>
      )}
      {player.role && (
        <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0', ROLE_COLORS[player.role])}>
          {ROLE_LABELS[player.role]}
        </span>
      )}
      <button onClick={onStartEdit}
        className="text-muted hover:text-gold p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg transition-colors shrink-0">
        <Edit2 size={13} />
      </button>
      {canRemove && (
        <button onClick={onRemove}
          className={cn('p-1.5 min-w-[32px] min-h-[32px] flex items-center justify-center rounded-lg transition-all shrink-0',
            pendingDelete ? 'bg-wicket text-white scale-110' : 'text-muted hover:text-wicket')}
          aria-label={pendingDelete ? 'Tap again to confirm removal' : 'Remove player'}>
          {pendingDelete ? <Check size={13} /> : <Trash2 size={13} />}
        </button>
      )}
    </div>
  );
}

// ─── EmptyState ───────────────────────────────────────────────────────────────

function EmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl bg-pitch-light flex items-center justify-center">
          <Users size={36} className="text-muted" />
        </div>
        <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl bg-gold/20 border border-gold/30 flex items-center justify-center">
          <Plus size={16} className="text-gold" />
        </div>
      </div>
      <div>
        <h2 className="text-white font-bold text-lg">No saved teams yet</h2>
        <p className="text-muted text-sm mt-1 max-w-[240px] mx-auto">
          Save your squad once — pick players each time you start a match.
        </p>
      </div>
      <Button variant="gold" size="lg" onClick={onNew}>
        <Plus size={18} className="inline mr-1" /> Create First Team
      </Button>
    </div>
  );
}
