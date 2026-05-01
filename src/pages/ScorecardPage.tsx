import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { UserPlus, Trophy, Share2 } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { BattingCard } from '@/components/scorecard/BattingCard';
import { BowlingCard } from '@/components/scorecard/BowlingCard';
import { FOWTable } from '@/components/scorecard/FOWTable';
import { OverByOver } from '@/components/scorecard/OverByOver';
import { Spinner } from '@/components/common/Spinner';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { getMatch, saveMatch } from '@/db/repos/matchRepo';
import { getMatchInnings } from '@/db/repos/inningsRepo';
import { getInningsDeliveries } from '@/db/repos/playerRepo';
import { computeInningsStats } from '@/utils/cricket';
import { formatScore, formatOversShort } from '@/utils/format';
import { buildShareText } from '@/utils/share';
import { buildShareImage, shareImageOrFallback } from '@/utils/shareImage';
import { useUIStore } from '@/store/uiStore';
import type { Match, Innings } from '@/types/match.types';
import type { InningsStats } from '@/types/delivery.types';
import { cn } from '@/utils/cn';
import { v4 as uuid } from 'uuid';

type Tab = 'batting' | 'bowling' | 'overs';
const TABS: { key: Tab; label: string }[] = [
  { key: 'batting', label: 'Batting' },
  { key: 'bowling', label: 'Bowling' },
  { key: 'overs',   label: 'Overs'   },
];

export default function ScorecardPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { addToast } = useUIStore();

  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<Match | null>(null);
  const [allInnings, setAllInnings] = useState<Array<{ innings: Innings; stats: InningsStats }>>([]);
  const [activeInnings, setActiveInnings] = useState(0);
  const [tab, setTab] = useState<Tab>('batting');

  const [editingPlayer, setEditingPlayer] = useState<{ id: string; name: string; teamId: string } | null>(null);
  const [editName, setEditName] = useState('');
  const [addingToTeamId, setAddingToTeamId] = useState<string | null>(null);
  const [newPlayerName, setNewPlayerName] = useState('');

  const recomputeStats = useCallback((m: Match, inningsList: Innings[]) => {
    const allPlayers = [...m.teams[0].players, ...m.teams[1].players];
    const resolveName = (id: string) => allPlayers.find((p) => p.id === id)?.name ?? id;
    return Promise.all(
      inningsList.map(async (i) => {
        const deliveries = await getInningsDeliveries(i.id);
        return { innings: i, stats: computeInningsStats(deliveries, resolveName) };
      })
    );
  }, []);

  useEffect(() => {
    (async () => {
      if (!matchId) return;
      const m = await getMatch(matchId);
      if (!m) { navigate('/'); return; }
      setMatch(m);
      const innings = await getMatchInnings(matchId);
      const withStats = await recomputeStats(m, innings);
      setAllInnings(withStats);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  const handleShare = async () => {
    if (!match) return;
    const allInn = allInnings.map((x) => x.innings);
    const inn1 = allInn.find((i) => i.inningsNumber === 1);
    const inn2 = allInn.find((i) => i.inningsNumber === 2);
    if (!inn1) return;
    const s1 = allInnings.find((x) => x.innings.id === inn1.id)!.stats;
    const s2 = inn2 ? allInnings.find((x) => x.innings.id === inn2.id)!.stats : null;
    const blob = await buildShareImage(match, inn1, s1, inn2 ?? null, s2);
    if (blob) {
      const fallback = buildShareText(match, inn1, s1, inn2 ?? null, s2);
      const result = await shareImageOrFallback(blob, fallback);
      if (result === 'copied') addToast('Scorecard copied!', 'success');
      if (result === 'failed') addToast('Could not share scorecard', 'error');
    } else {
      addToast('Could not generate scorecard image', 'error');
    }
  };

  const persistMatch = async (updated: Match) => {
    await saveMatch(updated);
    setMatch(updated);
    const innings = allInnings.map((x) => x.innings);
    const withStats = await recomputeStats(updated, innings);
    setAllInnings(withStats);
  };

  const handleRenamePlayer = async () => {
    if (!match || !editingPlayer || !editName.trim()) return;
    const trimmed = editName.trim();
    const updated: Match = {
      ...match,
      teams: match.teams.map((t) =>
        t.id === editingPlayer.teamId
          ? { ...t, players: t.players.map((p) => p.id === editingPlayer.id ? { ...p, name: trimmed } : p) }
          : t
      ) as Match['teams'],
    };
    await persistMatch(updated);
    addToast(`Renamed to "${trimmed}"`, 'success');
    setEditingPlayer(null);
  };

  const handleAddPlayer = async () => {
    if (!match || !addingToTeamId || !newPlayerName.trim()) return;
    const trimmed = newPlayerName.trim();
    const newPlayer = { id: uuid(), name: trimmed, teamId: addingToTeamId };
    const updated: Match = {
      ...match,
      teams: match.teams.map((t) =>
        t.id === addingToTeamId ? { ...t, players: [...t.players, newPlayer] } : t
      ) as Match['teams'],
    };
    await persistMatch(updated);
    addToast(`${trimmed} added to scorecard`, 'success');
    setAddingToTeamId(null);
    setNewPlayerName('');
  };

  if (loading) return <div className="min-h-screen bg-pitch flex items-center justify-center"><Spinner /></div>;
  if (!match) return null;

  const current = allInnings[activeInnings];
  const currentBattingTeam = match.teams.find((t) => t.id === current?.innings.battingTeamId);
  const currentBowlingTeam = match.teams.find((t) => t.id === current?.innings.bowlingTeamId);
  const isCompleted = match.status === 'completed';
  const winnerTeam = match.result?.winnerId
    ? match.teams.find((t) => t.id === match.result!.winnerId)
    : null;
  const isTie = isCompleted && !match.result?.winnerId;

  return (
    <div className="min-h-screen bg-pitch flex flex-col">
      <TopBar
        title="Scorecard"
        subtitle={match.name}
        showBack
        onBack={() => navigate(-1)}
        actions={
          <button
            onClick={handleShare}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gold/20 text-gold text-sm font-bold hover:bg-gold/30 active:scale-95 transition-all min-h-[36px]"
            aria-label="Share scorecard"
          >
            <Share2 size={15} /> Share
          </button>
        }
      />

      {/* Match result banner */}
      {isCompleted && match.result && (
        <div className={cn(
          'relative overflow-hidden mx-4 mt-3 rounded-2xl px-4 py-4 flex items-center gap-3',
          winnerTeam
            ? 'bg-gold/10 border border-gold/30'
            : isTie
              ? 'bg-safe/10 border border-safe/25'
              : 'bg-pitch-light border border-pitch-light',
        )}>
          {winnerTeam && (
            <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
          )}
          <div className={cn(
            'shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg leading-none',
            winnerTeam ? 'bg-gold/20' : isTie ? 'bg-safe/15' : 'bg-pitch-dark',
          )}>
            {winnerTeam ? '🏆' : isTie ? '🤝' : '🏏'}
          </div>
          <div className="min-w-0 flex-1">
            <p className={cn(
              'font-black text-sm leading-tight',
              winnerTeam ? 'text-gold' : isTie ? 'text-safe' : 'text-muted',
            )}>
              {match.result.resultText}
            </p>
            <p className="text-muted text-[11px] mt-0.5 opacity-60">{match.name} · Complete</p>
          </div>
          {winnerTeam && (
            <Trophy size={18} className="text-gold/50 shrink-0" />
          )}
        </div>
      )}

      {/* Innings selector */}
      {allInnings.length > 1 && (
        <div className="flex px-4 pt-3 gap-2">
          {allInnings.map((item, i) => {
            const teamName = match.teams.find((t) => t.id === item.innings.battingTeamId)?.name ?? `Inn ${i + 1}`;
            const score = formatScore(item.stats.totalRuns, item.stats.wickets);
            const overs = formatOversShort(item.stats.legalBalls);
            const isActive = activeInnings === i;
            const isWinnerInn = !!winnerTeam && item.innings.battingTeamId === winnerTeam.id;
            return (
              <button
                key={i}
                onClick={() => setActiveInnings(i)}
                className={cn(
                  'flex-1 py-3 px-3.5 rounded-2xl border transition-all text-left relative overflow-hidden',
                  isActive
                    ? 'bg-gold/[0.12] border-gold/50'
                    : 'bg-pitch-light border-pitch-light hover:border-gold/20 active:scale-[0.98]',
                )}
              >
                {isActive && isWinnerInn && (
                  <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
                )}
                <p className={cn('text-[10px] font-bold truncate uppercase tracking-wide mb-0.5', isActive ? 'text-gold' : 'text-muted')}>
                  {i === 0 ? '1st Inn' : '2nd Inn'}
                </p>
                <p className={cn('text-[11px] font-semibold truncate mb-1', isActive ? 'text-white' : 'text-muted')}>
                  {teamName}
                </p>
                <p className={cn('font-black text-xl leading-none tabular-nums', isActive ? 'text-white' : 'text-white')}>
                  {score}
                </p>
                <p className={cn('text-[10px] font-mono mt-0.5', isActive ? 'text-muted' : 'text-muted/70')}>
                  {overs} ov
                </p>
              </button>
            );
          })}
        </div>
      )}

      {/* Pill tab bar */}
      <div className="px-4 pt-3 pb-0">
        <div className="flex gap-1 bg-pitch-dark rounded-2xl p-1">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn(
                'flex-1 py-2 text-sm font-semibold rounded-xl transition-all',
                tab === key
                  ? 'bg-pitch-light text-gold shadow-[0_1px_3px_rgba(0,0,0,0.25)]'
                  : 'text-muted hover:text-white',
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {current && (
        <div className="flex-1 overflow-y-auto">
          {/* Sticky innings header */}
          <div className="sticky top-0 z-10 px-4 py-3 bg-pitch/95 backdrop-blur-md">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1 pr-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-black text-white text-sm leading-tight">
                    {match.teams.find((t) => t.id === current.innings.battingTeamId)?.name ?? 'Batting'}
                  </p>
                  <span className="text-[9px] font-bold text-muted bg-pitch-light border border-pitch-dark rounded-full px-2 py-0.5 uppercase tracking-wide">
                    {current.innings.inningsNumber === 1 ? '1st Inn' : '2nd Inn'}
                  </span>
                </div>
                <p className="text-muted text-xs mt-0.5 opacity-70">
                  vs {match.teams.find((t) => t.id === current.innings.bowlingTeamId)?.name}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-black text-white text-2xl leading-none tabular-nums">
                  {formatScore(current.stats.totalRuns, current.stats.wickets)}
                </p>
                <p className="text-muted font-mono text-[10px] mt-0.5">
                  {formatOversShort(current.stats.legalBalls)} ov
                </p>
              </div>
            </div>
            <div className="mt-2 h-px bg-pitch-dark" />
          </div>

          <div className="px-4 py-4 space-y-4">
            {tab === 'batting' && (
              <>
                <BattingCard
                  match={match}
                  innings={current.innings}
                  stats={current.stats}
                  onEditPlayer={(id) => {
                    const p = currentBattingTeam?.players.find((x) => x.id === id);
                    if (p) { setEditingPlayer({ id: p.id, name: p.name, teamId: currentBattingTeam!.id }); setEditName(p.name); }
                  }}
                />
                <button
                  onClick={() => setAddingToTeamId(currentBattingTeam?.id ?? null)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed border-gold/25 text-gold/80 text-sm font-semibold hover:bg-gold/[0.06] hover:border-gold/40 active:scale-[0.98] transition-all"
                >
                  <UserPlus size={15} />
                  Add missing player to scorecard
                </button>
                {current.stats.fallOfWickets.length > 0 && (
                  <FOWTable match={match} innings={current.innings} fallOfWickets={current.stats.fallOfWickets} />
                )}
              </>
            )}
            {tab === 'bowling' && (
              <BowlingCard
                match={match}
                innings={current.innings}
                stats={current.stats}
                onEditPlayer={(id) => {
                  const p = currentBowlingTeam?.players.find((x) => x.id === id);
                  if (p) { setEditingPlayer({ id: p.id, name: p.name, teamId: currentBowlingTeam!.id }); setEditName(p.name); }
                }}
              />
            )}
            {tab === 'overs' && (
              <OverByOver match={match} innings={current.innings} overSummaries={current.stats.overSummaries} />
            )}
          </div>
        </div>
      )}

      {/* Rename player modal */}
      <Modal isOpen={!!editingPlayer} onClose={() => setEditingPlayer(null)} title="Edit Player Name">
        <input
          autoFocus
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleRenamePlayer(); }}
          placeholder="Player name"
          className="w-full bg-pitch-dark border border-white/[0.08] rounded-2xl px-4 py-3 text-white placeholder-muted/40 focus:outline-none focus:ring-2 focus:ring-gold/40 mb-4 text-sm"
        />
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => setEditingPlayer(null)}>Cancel</Button>
          <Button variant="gold" fullWidth disabled={!editName.trim()} onClick={handleRenamePlayer}>Save</Button>
        </div>
      </Modal>

      {/* Add walk-in player modal */}
      <Modal
        isOpen={!!addingToTeamId}
        onClose={() => { setAddingToTeamId(null); setNewPlayerName(''); }}
        title="Add Player to Scorecard"
      >
        <p className="text-muted/70 text-sm mb-4 leading-relaxed">
          Add a player who wasn't listed before the match started — they'll appear in the scorecard going forward.
        </p>
        <input
          autoFocus
          value={newPlayerName}
          onChange={(e) => setNewPlayerName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') handleAddPlayer(); }}
          placeholder="Player name"
          className="w-full bg-pitch-dark border border-white/[0.08] rounded-2xl px-4 py-3 text-white placeholder-muted/40 focus:outline-none focus:ring-2 focus:ring-gold/40 mb-4 text-sm"
        />
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => { setAddingToTeamId(null); setNewPlayerName(''); }}>Cancel</Button>
          <Button variant="gold" fullWidth disabled={!newPlayerName.trim()} onClick={handleAddPlayer}>Add Player</Button>
        </div>
      </Modal>
    </div>
  );
}
