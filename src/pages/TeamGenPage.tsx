import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shuffle, UserPlus, Play, RefreshCw, X,
  Users, ChevronDown, ChevronUp, Download, Zap,
} from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { useTeams } from '@/hooks/useTeams';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';
import { v4 as uuid } from 'uuid';

const LS_SQUAD     = 'teamgen_squad_v1';
const LS_GUESTS    = 'teamgen_guests_v1';
const LS_GENERATED = 'teamgen_generated_v1';
const LS_GENTYPE   = 'teamgen_gentype_v1';

interface GenPlayer     { id: string; name: string }
interface GeneratedTeam { name: string; players: GenPlayer[] }

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function splitTeams(players: GenPlayer[], n: 2 | 3): GeneratedTeam[] {
  const teams: GeneratedTeam[] = Array.from({ length: n }, (_, i) => ({
    name: `Team ${String.fromCharCode(65 + i)}`,
    players: [],
  }));
  shuffle(players).forEach((p, i) => teams[i % n].players.push(p));
  return teams;
}

// Semantic team colour tokens — one per slot, always in this order
const TEAM_COLORS = [
  { pill: 'bg-gold/15 border-gold/40 text-gold',       dot: 'bg-gold',    name: 'text-gold',  hex: '#FFB800' },
  { pill: 'bg-safe/15 border-safe/40 text-safe',       dot: 'bg-safe',    name: 'text-safe',  hex: '#2A9D8F' },
  { pill: 'bg-four/15 border-four/40 text-four',       dot: 'bg-four',    name: 'text-four',  hex: '#3BC9DB' },
] as const;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TeamGenPage() {
  const navigate = useNavigate();
  const { teams, loading, loadTeams } = useTeams();
  const { addToast } = useUIStore();

  const [squadIds, setSquadIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(LS_SQUAD) ?? '[]') as string[]); }
    catch { return new Set(); }
  });
  const [guests, setGuests] = useState<GenPlayer[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_GUESTS) ?? '[]') as GenPlayer[]; }
    catch { return []; }
  });
  const [generated, setGenerated] = useState<GeneratedTeam[] | null>(() => {
    try { return JSON.parse(localStorage.getItem(LS_GENERATED) ?? 'null') as GeneratedTeam[] | null; }
    catch { return null; }
  });
  const [genType, setGenType] = useState<2 | 3>(() =>
    localStorage.getItem(LS_GENTYPE) === '3' ? 3 : 2,
  );

  const [showGuestModal, setShowGuestModal] = useState(false);
  const [guestName, setGuestName]           = useState('');
  const [downloading, setDownloading]       = useState(false);
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
  const [justGenerated, setJustGenerated]   = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadTeams(); }, [loadTeams]);

  const persistSquad     = (ids: Set<string>) => {
    try { localStorage.setItem(LS_SQUAD, JSON.stringify([...ids])); } catch {}
  };
  const persistGuests    = (gs: GenPlayer[]) => {
    try { localStorage.setItem(LS_GUESTS, JSON.stringify(gs)); } catch {}
  };
  const persistGenerated = (result: GeneratedTeam[] | null, type: 2 | 3) => {
    try {
      if (result) localStorage.setItem(LS_GENERATED, JSON.stringify(result));
      else        localStorage.removeItem(LS_GENERATED);
      localStorage.setItem(LS_GENTYPE, String(type));
    } catch {}
  };

  const togglePlayer = (id: string) => {
    setSquadIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      persistSquad(next);
      return next;
    });
  };

  const toggleAll = (playerIds: string[]) => {
    setSquadIds((prev) => {
      const next  = new Set(prev);
      const allIn = playerIds.every((id) => next.has(id));
      playerIds.forEach((id) => allIn ? next.delete(id) : next.add(id));
      persistSquad(next);
      return next;
    });
  };

  const savedPlayers = teams.flatMap((t) =>
    t.players.map((p) => ({ ...p, teamName: t.name, teamId: t.id })),
  );

  const squadPlayers: GenPlayer[] = [
    ...savedPlayers.filter((p) => squadIds.has(p.id)).map((p) => ({ id: p.id, name: p.name })),
    ...guests.filter((g) => squadIds.has(g.id)),
  ];

  const handleGenerate = (n: 2 | 3) => {
    setGenType(n);
    const result = splitTeams(squadPlayers, n);
    setGenerated(result);
    persistGenerated(result, n);
    setJustGenerated(true);
    setTimeout(() => setJustGenerated(false), 800);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 140);
  };

  const handleReshuffle = () => {
    if (!generated) return;
    setJustGenerated(true);
    setTimeout(() => setJustGenerated(false), 800);
    const result = splitTeams(squadPlayers, genType);
    setGenerated(result);
    persistGenerated(result, genType);
  };

  const handleClearGenerated = () => {
    setGenerated(null);
    persistGenerated(null, genType);
  };

  const handleAddGuest = () => {
    const name = guestName.trim();
    if (!name) return;
    const g: GenPlayer = { id: uuid(), name };
    const next = [...guests, g];
    setGuests(next);
    persistGuests(next);
    setSquadIds((prev) => { const s = new Set(prev); s.add(g.id); persistSquad(s); return s; });
    setGuestName('');
    setShowGuestModal(false);
    addToast(`${name} added to squad`, 'success');
  };

  const handleRemoveGuest = (id: string) => {
    const next = guests.filter((g) => g.id !== id);
    setGuests(next);
    persistGuests(next);
    setSquadIds((prev) => { const s = new Set(prev); s.delete(id); persistSquad(s); return s; });
  };

  const handleDownloadPng = async () => {
    if (!generated) return;
    setDownloading(true);
    try {
      const blob = await drawTeamsCard(generated, genType);
      if (!blob) throw new Error('canvas failed');
      // Try native share first (mobile)
      if (navigator.share && navigator.canShare) {
        const file = new File([blob], `teams-${new Date().toISOString().slice(0, 10)}.png`, { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: "Today's Teams" });
          addToast('Shared!', 'success');
          return;
        }
      }
      // Desktop: download
      const url  = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.download = `teams-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      addToast('Image saved — ready to share! 🏏', 'success');
    } catch {
      addToast('Could not save image', 'error');
    } finally {
      setDownloading(false);
    }
  };

  const handleStartMatch = (teamA?: GeneratedTeam, teamB?: GeneratedTeam) => {
    const tA = teamA ?? generated?.[0];
    const tB = teamB ?? generated?.[1];
    if (!tA || !tB) return;
    const aId = uuid(); const bId = uuid();
    navigate('/new-match', {
      state: {
        rematch: {
          teams: [
            { id: aId, name: tA.name, players: tA.players.map((p) => ({ id: p.id, name: p.name, teamId: aId })) },
            { id: bId, name: tB.name, players: tB.players.map((p) => ({ id: p.id, name: p.name, teamId: bId })) },
          ],
        },
      },
    });
  };

  const toggleTeamCollapse = (teamId: string) => {
    setCollapsedTeams((prev) => {
      const next = new Set(prev);
      next.has(teamId) ? next.delete(teamId) : next.add(teamId);
      return next;
    });
  };

  const isEmpty = !loading && savedPlayers.length === 0 && guests.length === 0;
  const canGen2  = squadPlayers.length >= 2;
  const canGen3  = squadPlayers.length >= 3;

  return (
    <div className="min-h-screen bg-pitch flex flex-col">
      <TopBar title="Team Generator" showBack onBack={() => navigate(-1)} />

      <div className="flex-1 px-4 pt-4 pb-28 space-y-4">

        {/* ── Squad hero counter ── */}
        <div className="relative overflow-hidden rounded-3xl bg-pitch-light border border-white/[0.06]">
          {/* Top accent */}
          <div className="h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
          <div className="px-5 py-4 flex items-center gap-4">
            {/* Count badge */}
            <div className="relative shrink-0">
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center transition-all duration-300',
                squadPlayers.length > 0
                  ? 'bg-gold/20 shadow-[0_0_20px_0_rgb(var(--color-gold)/0.2)]'
                  : 'bg-pitch-dark',
              )}>
                <span className={cn(
                  'font-display text-4xl leading-none transition-colors',
                  squadPlayers.length > 0 ? 'text-gold' : 'text-muted/40',
                )}>
                  {squadPlayers.length || '0'}
                </span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-black text-white text-base leading-tight">
                {squadPlayers.length === 0
                  ? "Today's Squad"
                  : `${squadPlayers.length} in today's squad`}
              </p>
              <p className="text-muted text-xs mt-0.5 leading-snug">
                {squadPlayers.length === 0
                  ? 'Tap players below to pick them'
                  : squadPlayers.length < 2
                    ? 'Need at least 2 to generate'
                    : canGen3
                      ? 'Ready — split into 2 or 3 teams'
                      : 'Ready for a 2-team split'}
              </p>
            </div>
            <button
              onClick={() => setShowGuestModal(true)}
              className="shrink-0 flex flex-col items-center gap-1 px-3 py-2.5 rounded-2xl bg-pitch-dark border border-white/[0.07] hover:border-gold/30 hover:bg-gold/[0.06] transition-all active:scale-95"
            >
              <UserPlus size={16} className="text-gold" />
              <span className="text-[10px] font-bold text-muted leading-none">Guest</span>
            </button>
          </div>
        </div>

        {/* ── Player pool ── */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 bg-pitch-light rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : isEmpty ? (
          <EmptyPool onGoToTeams={() => navigate('/teams')} />
        ) : (
          <div className="space-y-2.5">
            {teams.map((team) => {
              const collapsed = collapsedTeams.has(team.id);
              const allIn     = team.players.length > 0 && team.players.every((p) => squadIds.has(p.id));
              const inCount   = team.players.filter((p) => squadIds.has(p.id)).length;
              return (
                <div key={team.id} className="bg-pitch-light rounded-2xl overflow-hidden border border-white/[0.05]">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <Users size={12} className="text-muted/60 shrink-0" />
                      <p className="text-xs font-black text-white uppercase tracking-widest truncate">
                        {team.name}
                      </p>
                      <span className={cn(
                        'text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 leading-none',
                        inCount > 0 && inCount === team.players.length
                          ? 'bg-gold/20 text-gold'
                          : inCount > 0
                            ? 'bg-runs/15 text-runs'
                            : 'bg-pitch-dark text-muted/50',
                      )}>
                        {inCount}/{team.players.length}
                      </span>
                    </div>
                    <button
                      onClick={() => toggleAll(team.players.map((p) => p.id))}
                      className={cn(
                        'text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-all shrink-0',
                        allIn
                          ? 'text-wicket bg-wicket/10 hover:bg-wicket/20'
                          : 'text-gold bg-gold/10 hover:bg-gold/20',
                      )}
                    >
                      {allIn ? 'Remove all' : 'Select all'}
                    </button>
                    <button
                      onClick={() => toggleTeamCollapse(team.id)}
                      className="text-muted/50 hover:text-white p-1 transition-colors shrink-0"
                    >
                      {collapsed ? <ChevronDown size={15} /> : <ChevronUp size={15} />}
                    </button>
                  </div>
                  {!collapsed && (
                    <div className="px-3 pb-3 flex flex-wrap gap-2">
                      {team.players.map((player) => (
                        <PlayerChip
                          key={player.id}
                          name={player.name}
                          active={squadIds.has(player.id)}
                          onClick={() => togglePlayer(player.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Guests section */}
            {guests.length > 0 && (
              <div className="bg-pitch-light rounded-2xl overflow-hidden border border-wide/20">
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 flex items-center gap-2">
                    <UserPlus size={12} className="text-wide/70 shrink-0" />
                    <p className="text-xs font-black text-white uppercase tracking-widest">Guests</p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-wide/10 text-wide/70 leading-none">
                      Today only
                    </span>
                  </div>
                  <button
                    onClick={() => toggleAll(guests.map((g) => g.id))}
                    className="text-[11px] font-bold text-gold bg-gold/10 px-2.5 py-1.5 rounded-lg hover:bg-gold/20 transition-all"
                  >
                    {guests.every((g) => squadIds.has(g.id)) ? 'Remove all' : 'Select all'}
                  </button>
                </div>
                <div className="px-3 pb-3 flex flex-wrap gap-2">
                  {guests.map((g) => (
                    <PlayerChip
                      key={g.id}
                      name={g.name}
                      active={squadIds.has(g.id)}
                      onClick={() => togglePlayer(g.id)}
                      onRemove={() => handleRemoveGuest(g.id)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Generate CTA ── */}
        {!isEmpty && (
          <div className="space-y-2">
            {/* Primary: 2 teams */}
            <button
              disabled={!canGen2}
              onClick={() => handleGenerate(2)}
              className={cn(
                'relative w-full overflow-hidden rounded-2xl py-4 flex items-center justify-center gap-3 transition-all active:scale-[0.98]',
                canGen2
                  ? 'bg-gradient-to-r from-gold via-gold-light to-gold text-[#1a0e04] shadow-[0_0_24px_0_rgb(var(--color-gold)/0.35)] hover:shadow-[0_0_32px_0_rgb(var(--color-gold)/0.5)]'
                  : 'bg-pitch-light text-muted/40 cursor-not-allowed',
              )}
            >
              {canGen2 && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full animate-[shimmer_2.5s_linear_infinite]" />
              )}
              <Shuffle size={20} className={canGen2 ? 'text-[#1a0e04]' : 'text-muted/40'} />
              <span className="font-black text-lg">Split into 2 Teams</span>
            </button>

            {/* Secondary: 3 teams */}
            <button
              disabled={!canGen3}
              onClick={() => handleGenerate(3)}
              className={cn(
                'w-full rounded-2xl py-3 flex items-center justify-center gap-2 border transition-all active:scale-[0.98] text-sm font-bold',
                canGen3
                  ? 'border-white/[0.10] text-muted hover:border-gold/30 hover:text-gold hover:bg-gold/[0.05]'
                  : 'border-white/[0.04] text-muted/30 cursor-not-allowed',
              )}
            >
              <Shuffle size={15} />
              Split into 3 Teams
            </button>

            {!canGen2 && (
              <p className="text-muted/40 text-xs text-center pt-0.5">
                Select at least 2 players to generate
              </p>
            )}
          </div>
        )}

        {/* ── Generated results ── */}
        {generated && (
          <div ref={resultsRef} className={cn('space-y-3 pt-1', justGenerated ? 'animate-fade-in' : '')}>

            {/* Results header */}
            <div className="relative overflow-hidden rounded-2xl bg-pitch-light border border-white/[0.06] px-4 py-3.5">
              <div className="h-[2px] bg-gradient-to-r from-transparent via-gold/60 to-transparent absolute inset-x-0 top-0" />
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[9px] font-black text-gold/70 uppercase tracking-[2px]">
                      {genType === 2 ? '2-Team Split' : '3-Team Split'}
                    </span>
                    <span className="text-[9px] text-muted/50">·</span>
                    <span className="text-[9px] font-bold text-muted/60">
                      {generated.reduce((s, t) => s + t.players.length, 0)} players
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {generated.map((t, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <div className={cn('w-2 h-2 rounded-full', TEAM_COLORS[i].dot)} />
                        <span className={cn('text-sm font-black', TEAM_COLORS[i].name)}>
                          {t.name}
                        </span>
                        <span className="text-muted/50 text-xs">{t.players.length}</span>
                        {i < generated.length - 1 && <span className="text-muted/30 text-xs ml-0.5">·</span>}
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  onClick={handleReshuffle}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-gold text-xs font-bold bg-gold/10 border border-gold/20 hover:bg-gold/20 transition-all active:scale-95"
                >
                  <RefreshCw size={12} /> Reshuffle
                </button>
              </div>
            </div>

            {/* Team cards */}
            <div className="space-y-2.5">
              {generated.map((team, ti) => {
                const c = TEAM_COLORS[ti];
                return (
                  <div key={ti} className="rounded-2xl overflow-hidden bg-pitch-light border border-white/[0.06]">
                    {/* Coloured top bar */}
                    <div className={cn('h-[3px] w-full', c.dot)} />
                    {/* Team header */}
                    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/[0.04]">
                      <div className={cn('w-8 h-8 rounded-xl flex items-center justify-center text-[11px] font-black', c.pill)}>
                        {String.fromCharCode(65 + ti)}
                      </div>
                      <p className={cn('font-black text-lg tracking-wide flex-1', c.name)}>
                        {team.name}
                      </p>
                      <span className={cn('text-xs font-bold px-2.5 py-1 rounded-full border', c.pill)}>
                        {team.players.length} players
                      </span>
                    </div>
                    {/* Player rows */}
                    <div>
                      {team.players.map((p, pi) => (
                        <div
                          key={p.id}
                          className={cn(
                            'flex items-center gap-3 px-4 py-2.5',
                            'border-b border-white/[0.03] last:border-0',
                            pi % 2 === 1 ? 'bg-black/[0.03]' : '',
                          )}
                        >
                          <span className="text-muted/40 text-xs w-5 text-right shrink-0 font-mono tabular-nums">
                            {pi + 1}
                          </span>
                          <span className="text-white text-sm font-semibold truncate flex-1">
                            {p.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Action bar */}
            <div className="space-y-2.5 pt-1">
              {/* Download / Share PNG — hero action */}
              <button
                onClick={handleDownloadPng}
                disabled={downloading}
                className={cn(
                  'relative w-full overflow-hidden flex items-center justify-center gap-2.5 py-4 rounded-2xl',
                  'bg-pitch-light border border-gold/30 text-gold font-black text-base',
                  'hover:border-gold/60 hover:bg-gold/[0.06] active:scale-[0.98] transition-all',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                )}
              >
                <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
                {downloading
                  ? <RefreshCw size={18} className="animate-spin" />
                  : <Download size={18} />}
                {downloading ? 'Generating image…' : 'Save & Share as Image'}
              </button>

              {/* Secondary actions */}
              {generated.length === 2 ? (
                <Button variant="gold" size="md" fullWidth onClick={() => handleStartMatch()}>
                  <Play size={15} className="mr-1.5" /> Start Match
                </Button>
              ) : (
                <div className="space-y-2.5">
                  <div>
                    <p className="text-[10px] font-black text-muted/50 uppercase tracking-[2px] mb-2 px-1">
                      Pick a fixture to start
                    </p>
                    <div className="space-y-2">
                      {generated.flatMap((_, i) =>
                        generated.slice(i + 1).map((_, j) => {
                          const tA = generated[i];
                          const tB = generated[i + 1 + j];
                          const tW = generated.find((t) => t !== tA && t !== tB)!;
                          const cA = TEAM_COLORS[i];
                          const cB = TEAM_COLORS[i + 1 + j];
                          const cW = TEAM_COLORS[generated.indexOf(tW)];
                          return (
                            <button
                              key={`${i}-${i + 1 + j}`}
                              onClick={() => handleStartMatch(tA, tB)}
                              className="w-full flex items-center gap-3 bg-pitch-light border border-white/[0.07] rounded-2xl px-4 py-3 hover:border-gold/30 hover:bg-gold/[0.04] active:scale-[0.98] transition-all text-left"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <div className={cn('w-2 h-2 rounded-full shrink-0', cA.dot)} />
                                  <span className={cn('font-bold text-sm', cA.name)}>{tA.name}</span>
                                  <span className="text-muted/50 text-xs">vs</span>
                                  <div className={cn('w-2 h-2 rounded-full shrink-0', cB.dot)} />
                                  <span className={cn('font-bold text-sm', cB.name)}>{tB.name}</span>
                                </div>
                                <p className="text-[11px] text-muted/50 mt-0.5 pl-3.5">
                                  <span className={cn('font-semibold', cW.name)}>{tW.name}</span> waits
                                </p>
                              </div>
                              <div className="flex items-center gap-1.5 bg-gold/10 border border-gold/25 rounded-xl px-3 py-1.5 shrink-0">
                                <Play size={12} className="text-gold" />
                                <span className="text-gold text-xs font-black">Play</span>
                              </div>
                            </button>
                          );
                        }),
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Clear teams */}
              <button
                onClick={handleClearGenerated}
                className="w-full py-3 rounded-2xl text-muted/50 text-sm font-semibold hover:text-wicket transition-colors"
              >
                Clear teams
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Guest modal ── */}
      <Modal
        isOpen={showGuestModal}
        onClose={() => { setShowGuestModal(false); setGuestName(''); }}
        title="Add Guest Player"
      >
        <p className="text-muted/70 text-sm mb-4 leading-relaxed">
          Add a walk-in for today — they won't affect your saved squads.
        </p>
        <input
          autoFocus
          value={guestName}
          onChange={(e) => setGuestName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddGuest()}
          placeholder="Guest player name"
          className="w-full bg-pitch-dark border border-white/[0.08] rounded-2xl px-4 py-3 text-white placeholder-muted/40 focus:outline-none focus:ring-2 focus:ring-gold/40 mb-4 text-sm"
        />
        <div className="flex gap-3">
          <Button variant="secondary" size="lg" fullWidth
            onClick={() => { setShowGuestModal(false); setGuestName(''); }}>
            Cancel
          </Button>
          <Button variant="gold" size="lg" fullWidth
            disabled={!guestName.trim()} onClick={handleAddGuest}>
            Add Guest
          </Button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Canvas — premium dark share card ────────────────────────────────────────

const PNG_COLORS = [
  { accent: '#FFB800', headerBg: 'rgba(255,184,0,0.14)',  border: 'rgba(255,184,0,0.4)'  },
  { accent: '#2A9D8F', headerBg: 'rgba(42,157,143,0.14)', border: 'rgba(42,157,143,0.4)' },
  { accent: '#3BC9DB', headerBg: 'rgba(59,201,219,0.14)', border: 'rgba(59,201,219,0.4)' },
];

function pngRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function pngText(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number, y: number,
  opts: { size?: number; weight?: string; color?: string; align?: CanvasTextAlign; maxWidth?: number } = {},
) {
  const { size = 14, weight = '600', color = '#E8F0E2', align = 'left', maxWidth } = opts;
  ctx.font      = `${weight} ${size}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  if (maxWidth && maxWidth > 0) ctx.fillText(value, x, y, maxWidth);
  else if (!maxWidth) ctx.fillText(value, x, y);
}

async function drawTeamsCard(generated: GeneratedTeam[], genType: 2 | 3): Promise<Blob | null> {
  const W       = 720;
  const PAD     = 40;
  const INNER   = W - PAD * 2;
  const GAP     = 16;
  const HDR_H   = 52;
  const ROW_H   = 44;
  const CARD_R  = 16;

  const teamCardH = (team: GeneratedTeam) => HDR_H + team.players.length * ROW_H + 20;

  const is3 = genType === 3;
  const headerH = 130;
  const footerH = 64;

  let teamsH: number;
  if (!is3) {
    teamsH = Math.max(...generated.map(teamCardH));
  } else {
    const row1H = Math.max(teamCardH(generated[0]), teamCardH(generated[1]));
    teamsH = row1H + GAP + teamCardH(generated[2]);
  }

  const totalH = PAD + headerH + 24 + teamsH + 24 + footerH + PAD;

  const canvas  = document.createElement('canvas');
  canvas.width  = W * 2;
  canvas.height = totalH * 2;
  const ctx     = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.scale(2, 2);

  // ── Background ──
  ctx.fillStyle = '#0C0F0A';
  ctx.fillRect(0, 0, W, totalH);

  // Grass green radial glow top-centre
  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.8);
  glow.addColorStop(0,   'rgba(16,100,48,0.5)');
  glow.addColorStop(0.5, 'rgba(16,100,48,0.15)');
  glow.addColorStop(1,   'rgba(16,100,48,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, totalH);

  // Gold top bar
  const topBar = ctx.createLinearGradient(0, 0, W, 0);
  topBar.addColorStop(0,    '#FFB80000');
  topBar.addColorStop(0.25, '#FFB800');
  topBar.addColorStop(0.75, '#FFB800');
  topBar.addColorStop(1,    '#FFB80000');
  ctx.fillStyle = topBar;
  ctx.fillRect(0, 0, W, 4);

  let y = PAD;

  // ── Header ──
  // Cricket emoji centred
  ctx.font      = '48px system-ui';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#E8F0E2';
  ctx.fillText('🏏', W / 2, y + 44);
  y += 56;

  // Title
  pngText(ctx, "TODAY'S TEAMS", W / 2, y + 22, {
    size: 26, weight: '900', color: '#FFB800', align: 'center',
  });
  y += 30;

  // Subtitle
  const totalPlayers = generated.reduce((s, t) => s + t.players.length, 0);
  const date = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  pngText(
    ctx,
    `${totalPlayers} players  ·  ${is3 ? 'Tri-series' : 'Two teams'}  ·  ${date}`,
    W / 2, y + 16, { size: 12, weight: '400', color: '#8FA883', align: 'center' },
  );
  y += 28;

  // Gold gradient separator
  const sep = ctx.createLinearGradient(PAD, 0, PAD + INNER, 0);
  sep.addColorStop(0,    '#FFB80000');
  sep.addColorStop(0.25, '#FFB800');
  sep.addColorStop(0.75, '#FFB800');
  sep.addColorStop(1,    '#FFB80000');
  ctx.strokeStyle = sep;
  ctx.lineWidth   = 1.5;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(PAD + INNER, y);
  ctx.stroke();
  y += 24;

  // ── Draw one team card ──
  const drawTeam = (team: GeneratedTeam, ti: number, tx: number, ty: number, tw: number) => {
    const c  = PNG_COLORS[ti];
    const th = teamCardH(team);

    // Card shadow
    ctx.shadowColor   = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur    = 20;
    ctx.shadowOffsetY = 4;

    // Card body
    pngRoundRect(ctx, tx, ty, tw, th, CARD_R);
    ctx.fillStyle = '#141810';
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.shadowBlur  = 0;
    ctx.shadowOffsetY = 0;

    // Card border
    pngRoundRect(ctx, tx, ty, tw, th, CARD_R);
    ctx.strokeStyle = c.border;
    ctx.lineWidth   = 1;
    ctx.stroke();

    // Top colour bar
    ctx.save();
    pngRoundRect(ctx, tx, ty, tw, 4, CARD_R);
    ctx.clip();
    ctx.fillStyle = c.accent;
    ctx.fillRect(tx, ty, tw, 4);
    ctx.restore();

    // Header background
    ctx.save();
    pngRoundRect(ctx, tx, ty + 4, tw, HDR_H - 4, 0);
    ctx.fillStyle = c.headerBg;
    ctx.fill();
    ctx.restore();

    // Team letter badge
    const badgeSize = 32;
    pngRoundRect(ctx, tx + 16, ty + (HDR_H - badgeSize) / 2 + 2, badgeSize, badgeSize, 8);
    ctx.fillStyle = c.accent + '30';
    ctx.fill();
    pngRoundRect(ctx, tx + 16, ty + (HDR_H - badgeSize) / 2 + 2, badgeSize, badgeSize, 8);
    ctx.strokeStyle = c.accent + '60';
    ctx.lineWidth = 1;
    ctx.stroke();
    pngText(ctx, String.fromCharCode(65 + ti), tx + 16 + badgeSize / 2, ty + (HDR_H / 2) + 8, {
      size: 16, weight: '900', color: c.accent, align: 'center',
    });

    // Team name
    pngText(ctx, team.name.toUpperCase(), tx + 58, ty + HDR_H / 2 + 7, {
      size: 18, weight: '900', color: c.accent,
    });

    // Player count (right)
    pngText(ctx, `${team.players.length} players`, tx + tw - 16, ty + HDR_H / 2 + 7, {
      size: 11, weight: '600', color: c.accent + 'aa', align: 'right',
    });

    // Header divider
    ctx.fillStyle = c.accent + '25';
    ctx.fillRect(tx, ty + HDR_H, tw, 1);

    // Player rows
    team.players.forEach((p, pi) => {
      const py = ty + HDR_H + 10 + pi * ROW_H;

      // Alternating row tint
      if (pi % 2 === 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(tx, py, tw, ROW_H);
      }
      // Row separator
      if (pi > 0) {
        ctx.fillStyle = 'rgba(255,255,255,0.04)';
        ctx.fillRect(tx + 16, py, tw - 32, 1);
      }

      // Number
      pngText(ctx, String(pi + 1).padStart(2, ' '), tx + 20, py + ROW_H / 2 + 5, {
        size: 11, weight: '700', color: 'rgba(255,255,255,0.25)', align: 'right',
      });

      // Player name — truncate if needed
      const maxNameW = tw - 56;
      let name = p.name;
      ctx.font = `600 14px system-ui, -apple-system, sans-serif`;
      while (ctx.measureText(name).width > maxNameW && name.length > 3) {
        name = name.slice(0, -1);
      }
      if (name !== p.name) name += '…';
      pngText(ctx, name, tx + 44, py + ROW_H / 2 + 5, {
        size: 14, weight: '600', color: '#E8F0E2',
      });
    });
  };

  if (!is3) {
    const colW = (INNER - GAP) / 2;
    generated.forEach((team, ti) => {
      drawTeam(team, ti, PAD + ti * (colW + GAP), y, colW);
    });
    y += Math.max(...generated.map(teamCardH));
  } else {
    const colW = (INNER - GAP) / 2;
    drawTeam(generated[0], 0, PAD, y, colW);
    drawTeam(generated[1], 1, PAD + colW + GAP, y, colW);
    y += Math.max(teamCardH(generated[0]), teamCardH(generated[1])) + GAP;
    drawTeam(generated[2], 2, PAD, y, INNER);
    y += teamCardH(generated[2]);
  }

  y += 24;

  // Footer separator
  const footSep = ctx.createLinearGradient(PAD, 0, PAD + INNER, 0);
  footSep.addColorStop(0,    '#FFB80000');
  footSep.addColorStop(0.25, '#FFB80066');
  footSep.addColorStop(0.75, '#FFB80066');
  footSep.addColorStop(1,    '#FFB80000');
  ctx.strokeStyle = footSep;
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(PAD + INNER, y);
  ctx.stroke();
  y += 20;

  pngText(ctx, '🏏  CricScore', W / 2, y + 14, {
    size: 12, weight: '700', color: '#4D5E47', align: 'center',
  });

  return new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png', 1.0);
  });
}

// ─── PlayerChip ───────────────────────────────────────────────────────────────

function PlayerChip({
  name, active, onClick, onRemove,
}: {
  name: string; active: boolean; onClick: () => void; onRemove?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-1.5 rounded-xl border text-sm font-semibold transition-all active:scale-95',
        'px-3 py-2',
        active
          ? 'bg-gold/15 border-gold/50 text-gold shadow-[0_0_8px_0_rgb(var(--color-gold)/0.2)]'
          : 'bg-pitch-dark border-white/[0.08] text-muted hover:border-gold/25 hover:text-white',
      )}
    >
      <span className="leading-none">{name}</span>
      {onRemove && (
        <span
          role="button"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
          className="-mr-1.5 flex items-center justify-center w-5 h-5 rounded-lg hover:bg-wicket/20 hover:text-wicket text-muted/40 transition-colors"
        >
          <X size={10} />
        </span>
      )}
    </button>
  );
}

// ─── EmptyPool ────────────────────────────────────────────────────────────────

function EmptyPool({ onGoToTeams }: { onGoToTeams: () => void }) {
  return (
    <div className="relative overflow-hidden bg-pitch-light rounded-3xl p-8 text-center border border-white/[0.05]">
      <div className="h-[2px] bg-gradient-to-r from-transparent via-gold/30 to-transparent absolute inset-x-0 top-0" />
      <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-4">
        <Zap size={28} className="text-gold/60" />
      </div>
      <p className="text-white font-black text-lg mb-1.5">No players yet</p>
      <p className="text-muted/70 text-sm mb-6 leading-relaxed max-w-[260px] mx-auto">
        Add players to your saved teams, or tap <span className="text-gold font-bold">Guest</span> above to add today's players directly.
      </p>
      <Button variant="secondary" size="md" onClick={onGoToTeams}>
        Go to My Teams →
      </Button>
    </div>
  );
}
