import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Shuffle, UserPlus, Play, RefreshCw, X,
  ChevronDown, ChevronUp, Download, Zap, Scale, Upload, Plus, Search,
} from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/common/Button';
import { Modal } from '@/components/common/Modal';
import { useTeams } from '@/hooks/useTeams';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';
import { buildRosterIndex } from '@/utils/roster';
import {
  COOLDOWN_GENS, cooldownRemaining, importLegacyHistory, makeFairTeams, recordFor, recordGeneration,
} from '@/utils/fairSplit';
import { getFairnessHistory, saveFairnessHistory } from '@/db/repos/fairnessRepo';
import type { FairnessHistory } from '@/types/season.types';
import { DEFAULT_CONFIG } from '@/types/match.types';
import { v4 as uuid } from 'uuid';

const LS_SQUAD     = 'teamgen_squad_v1';
const LS_GUESTS    = 'teamgen_guests_v1';
const LS_GENERATED = 'teamgen_generated_v2';
const LS_GENTYPE   = 'teamgen_gentype_v1';

const GUEST = 'guest';

interface GenPlayer     { id: string; name: string }
interface GeneratedTeam { name: string; players: GenPlayer[]; captainId?: string }
/** A split on screen. `recorded` flips once Start Match writes it to history. */
interface GeneratedSplit { teams: GeneratedTeam[]; orderedIds: string[]; recorded: boolean }

/** "6 v 6" / "4 · 4 · 3" — team sizes the split will produce. */
function teamSizePreview(players: number, teams: 2 | 3): string {
  const sizes = Array.from({ length: teams }, (_, i) => Math.floor(players / teams) + (i < players % teams ? 1 : 0));
  return teams === 2 ? `${sizes[0]} v ${sizes[1]}` : sizes.join(' · ');
}

/** Default overs for a fixture: size of the bigger team, within the 1–50 allowed. */
function defaultOvers(a: GeneratedTeam, b: GeneratedTeam): number {
  return Math.min(50, Math.max(1, a.players.length, b.players.length));
}

function loadGenerated(): GeneratedSplit | null {
  try { return JSON.parse(localStorage.getItem(LS_GENERATED) ?? 'null') as GeneratedSplit | null; }
  catch { return null; }
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
  const { teams, loading, loadTeams, addPlayer, createTeam } = useTeams();
  const { addToast } = useUIStore();

  const [squadIds, setSquadIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(LS_SQUAD) ?? '[]') as string[]); }
    catch { return new Set(); }
  });
  const [guests, setGuests] = useState<GenPlayer[]>(() => {
    try { return JSON.parse(localStorage.getItem(LS_GUESTS) ?? '[]') as GenPlayer[]; }
    catch { return []; }
  });
  const [split, setSplit] = useState<GeneratedSplit | null>(loadGenerated);
  const generated = split?.teams ?? null;
  const [genType, setGenType] = useState<2 | 3>(() =>
    localStorage.getItem(LS_GENTYPE) === '3' ? 3 : 2,
  );
  const [history, setHistory] = useState<FairnessHistory | null>(null);
  const [showFairness, setShowFairness] = useState(false);
  const [showResetHistory, setShowResetHistory] = useState(false);
  const historyFileRef = useRef<HTMLInputElement>(null);

  // Add-player sheet: target is a saved team id or GUEST; null = closed
  const [addTarget, setAddTarget]           = useState<string | null>(null);
  const [newName, setNewName]               = useState('');
  const [search, setSearch]                 = useState('');
  const [downloading, setDownloading]       = useState(false);
  const [collapsedTeams, setCollapsedTeams] = useState<Set<string>>(new Set());
  const [justGenerated, setJustGenerated]   = useState(false);

  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => { loadTeams(); }, [loadTeams]);
  useEffect(() => { getFairnessHistory().then(setHistory); }, []);

  const persistSquad     = (ids: Set<string>) => {
    try { localStorage.setItem(LS_SQUAD, JSON.stringify([...ids])); } catch {}
  };
  const persistGuests    = (gs: GenPlayer[]) => {
    try { localStorage.setItem(LS_GUESTS, JSON.stringify(gs)); } catch {}
  };
  const persistGenerated = (result: GeneratedSplit | null, type: 2 | 3) => {
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

  // Same person may be saved in two teams — keep one chip per id
  const squadPlayers: GenPlayer[] = [
    ...new Map(savedPlayers.filter((p) => squadIds.has(p.id)).map((p) => [p.id, { id: p.id, name: p.name }])).values(),
    ...guests.filter((g) => squadIds.has(g.id)).map((g) => ({ id: g.id, name: g.name })),
  ];
  const roster = buildRosterIndex(teams);
  const query = search.trim().toLowerCase();
  const matchesSearch = (p: { name: string }) => !query || p.name.toLowerCase().includes(query);

  // Draws a split from the current history. Nothing is recorded until Start Match,
  // so reshuffling cannot be used to game captaincy counts.
  const drawSplit = (n: 2 | 3) => {
    if (!history) return;
    const result = makeFairTeams(squadPlayers, n, history, roster.isRosterId);
    const next: GeneratedSplit = {
      teams: result.teams.map((players, i) => ({
        name: `Team ${String.fromCharCode(65 + i)}`,
        players,
        captainId: result.captainIds[i],
      })),
      orderedIds: result.orderedIds,
      recorded: false,
    };
    setSplit(next);
    persistGenerated(next, n);
    setJustGenerated(true);
    setTimeout(() => setJustGenerated(false), 800);
    if (result.relaxed) addToast('Captain cooldown relaxed — everyone captained recently', 'info');
  };

  const handleGenerate = (n: 2 | 3) => {
    setGenType(n);
    drawSplit(n);
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 140);
  };

  const handleReshuffle = () => {
    if (!generated) return;
    drawSplit(genType);
  };

  const handleClearGenerated = () => {
    setSplit(null);
    persistGenerated(null, genType);
  };

  /** Write the split being played to fairness history (once per split). */
  const recordSplit = async () => {
    if (!split || split.recorded || !history) return;
    const captainIds = split.teams.map((t) => t.captainId).filter((id): id is string => !!id);
    const next = recordGeneration(history, captainIds, split.orderedIds, roster.isRosterId);
    await saveFairnessHistory(next);
    setHistory({ ...history, ...next });
    const recordedSplit = { ...split, recorded: true };
    setSplit(recordedSplit);
    persistGenerated(recordedSplit, genType);
  };

  const handleImportHistory = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const { history: imported, unmatched } = importLegacyHistory(JSON.parse(await file.text()), roster.idForName);
      await saveFairnessHistory(imported);
      setHistory(await getFairnessHistory());
      addToast(
        unmatched.length
          ? `History imported · not on roster: ${unmatched.slice(0, 4).join(', ')}${unmatched.length > 4 ? '…' : ''}`
          : `History imported · generation ${imported.generation}`,
        unmatched.length ? 'info' : 'success',
      );
    } catch {
      addToast('Invalid history file', 'error');
    }
  };

  /** Export in the HTML generator's format (keyed by name) so it stays readable. */
  const handleExportHistory = () => {
    if (!history) return;
    const names = new Map(savedPlayers.map((p) => [p.id, p.name]));
    const players = Object.fromEntries(
      Object.entries(history.players).flatMap(([id, rec]) => (names.has(id) ? [[names.get(id), rec]] : [])),
    );
    const payload = { exportedAt: new Date().toISOString(), app: 'CricScore Team Generator', version: 5, history: { generation: history.generation, players } };
    const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `fair-history-gen-${history.generation}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
  };

  const handleResetHistory = async () => {
    await saveFairnessHistory({ generation: 0, players: {} });
    setHistory(await getFairnessHistory());
    setShowResetHistory(false);
    addToast('Fairness history reset', 'info');
  };

  const pickForToday = (id: string) =>
    setSquadIds((prev) => { const s = new Set(prev); s.add(id); persistSquad(s); return s; });

  const openAddSheet = (teamId?: string) => {
    setNewName('');
    setAddTarget(teamId ?? teams[0]?.id ?? GUEST);
  };
  const closeAddSheet = () => { setAddTarget(null); setNewName(''); };

  // Adds a player without leaving the page. The sheet stays open so several
  // late arrivals can be added in a row.
  const handleAddPlayer = async () => {
    const name = newName.trim().replace(/\s+/g, ' ');
    if (!name || !addTarget) return;
    const rosterId = roster.idForName(name);
    try {
      if (addTarget === GUEST) {
        if (rosterId) {
          // Already a club player — use them so their stats count
          pickForToday(rosterId);
          addToast(`${name} is on the club roster — picked`, 'info');
        } else if (guests.some((g) => g.name.toLowerCase() === name.toLowerCase())) {
          addToast(`${name} is already a guest`, 'info');
        } else {
          const g: GenPlayer = { id: uuid(), name };
          const next = [...guests, g];
          setGuests(next);
          persistGuests(next);
          pickForToday(g.id);
          addToast(`${name} added as guest`, 'success');
        }
      } else {
        const team = teams.find((t) => t.id === addTarget);
        if (!team) return;
        const inTeam = team.players.find((p) => p.name.trim().toLowerCase() === name.toLowerCase());
        const id = inTeam?.id ?? rosterId ?? uuid();
        if (!inTeam) await addPlayer(team.id, name, undefined, undefined, id);
        pickForToday(id);
        addToast(inTeam ? `${name} is already in ${team.name} — picked` : `${name} added to ${team.name}`, 'success');
      }
      setNewName('');
    } catch {
      addToast('Failed to add player', 'error');
    }
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

  const handleStartMatch = async (teamA?: GeneratedTeam, teamB?: GeneratedTeam) => {
    const tA = teamA ?? generated?.[0];
    const tB = teamB ?? generated?.[1];
    if (!tA || !tB) return;
    await recordSplit();
    const aId = uuid(); const bId = uuid();
    const biggest = Math.max(tA.players.length, tB.players.length);
    navigate('/new-match', {
      state: {
        rematch: {
          // Street default: one over per player of the bigger side (7 v 6 → 7 overs).
          // Editable on the New Match format step.
          config: { ...DEFAULT_CONFIG, overs: defaultOvers(tA, tB), playersPerSide: biggest },
          teams: [
            { id: aId, name: tA.name, players: tA.players.map((p) => ({ id: p.id, name: p.name, teamId: aId })), captainId: tA.captainId },
            { id: bId, name: tB.name, players: tB.players.map((p) => ({ id: p.id, name: p.name, teamId: bId })), captainId: tB.captainId },
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
  // Generate bar: pick a team count, then one action (split / reshuffle)
  const barCount: 2 | 3 = genType === 3 && canGen3 ? 3 : 2;
  const canSplit = barCount === 2 ? canGen2 : canGen3;
  const isReshuffle = !!generated && generated.length === barCount;
  const selectTeamCount = (n: 2 | 3) => {
    setGenType(n);
    try { localStorage.setItem(LS_GENTYPE, String(n)); } catch {}
  };

  return (
    <div className="min-h-full bg-pitch flex flex-col">
      <TopBar
        title="Squad"
        subtitle={squadPlayers.length ? `${squadPlayers.length} picked for today` : "Pick today's players"}
        actions={
          <>
            {history && !isEmpty && (
              <button
                onClick={() => setShowFairness(true)}
                className="flex items-center gap-1 h-9 px-2.5 rounded-xl text-muted hover:text-gold hover:bg-pitch-light/60 transition-all"
                aria-label="Captain fairness"
              >
                <Scale size={17} />
                <span className="text-[11px] font-bold tabular-nums">{history.generation}</span>
              </button>
            )}
            <button
              onClick={() => openAddSheet()}
              className="flex items-center justify-center w-9 h-9 rounded-xl text-gold hover:bg-gold/10 transition-all"
              aria-label="Add player"
            >
              <UserPlus size={18} />
            </button>
          </>
        }
      />

      <div className="flex-1 px-4 pt-3 pb-4 space-y-3">

        {/* ── Player pool ── */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2].map((i) => (
              <div key={i} className="h-24 bg-pitch-light rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : isEmpty ? (
          <EmptyPool
            onAdd={async () => {
              // First player ever: give the roster a home so stats count from day one
              const club = teams[0] ?? await createTeam('Club');
              openAddSheet(club.id);
            }}
            onGoToTeams={() => navigate('/teams')}
          />
        ) : (
          <div className="space-y-2.5">
            {/* Search — handy once the club list is long */}
            {savedPlayers.length > 12 && (
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/60" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search players"
                  className="w-full bg-pitch-light border border-white/[0.06] rounded-2xl pl-10 pr-10 py-3 text-white text-sm placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-gold/40"
                />
                {search && (
                  <button
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-muted hover:text-white"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            )}

            {teams.map((team) => {
              const visible = team.players.filter(matchesSearch);
              if (query && visible.length === 0) return null;
              const collapsed = !query && collapsedTeams.has(team.id);
              const allIn     = team.players.length > 0 && team.players.every((p) => squadIds.has(p.id));
              const inCount   = team.players.filter((p) => squadIds.has(p.id)).length;
              return (
                <div key={team.id} className="bg-pitch-light rounded-2xl overflow-hidden border border-white/[0.05]">
                  <div className="flex items-center gap-2 pl-4 pr-2 py-2">
                    <button
                      onClick={() => toggleTeamCollapse(team.id)}
                      className="flex-1 flex items-center gap-2 min-w-0 min-h-[40px] text-left"
                    >
                      {collapsed ? <ChevronDown size={14} className="text-muted/60 shrink-0" /> : <ChevronUp size={14} className="text-muted/60 shrink-0" />}
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
                    </button>
                    <button
                      onClick={() => toggleAll(team.players.map((p) => p.id))}
                      className={cn(
                        'text-[11px] font-bold px-3 min-h-[36px] rounded-lg transition-all shrink-0',
                        allIn
                          ? 'text-wicket bg-wicket/10 hover:bg-wicket/20'
                          : 'text-gold bg-gold/10 hover:bg-gold/20',
                      )}
                    >
                      {allIn ? 'Clear' : 'All'}
                    </button>
                  </div>
                  {!collapsed && (
                    <div className="px-3 pb-3 flex flex-wrap gap-2">
                      {visible.map((player) => (
                        <PlayerChip
                          key={player.id}
                          name={player.name}
                          active={squadIds.has(player.id)}
                          onClick={() => togglePlayer(player.id)}
                        />
                      ))}
                      {!query && (
                        <button
                          onClick={() => openAddSheet(team.id)}
                          className="flex items-center gap-1 rounded-xl border border-dashed border-gold/35 text-gold text-sm font-semibold px-3 py-2 hover:bg-gold/10 active:scale-95 transition-all"
                        >
                          <Plus size={13} /> Add
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Guests section */}
            {guests.filter(matchesSearch).length > 0 && (
              <div className="bg-pitch-light rounded-2xl overflow-hidden border border-wide/20">
                <div className="flex items-center gap-2 pl-4 pr-2 py-2">
                  <div className="flex-1 flex items-center gap-2 min-h-[40px]">
                    <UserPlus size={12} className="text-wide/70 shrink-0" />
                    <p className="text-xs font-black text-white uppercase tracking-widest">Guests</p>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-wide/10 text-wide/70 leading-none">
                      No stats
                    </span>
                  </div>
                  <button
                    onClick={() => toggleAll(guests.map((g) => g.id))}
                    className="text-[11px] font-bold text-gold bg-gold/10 px-3 min-h-[36px] rounded-lg hover:bg-gold/20 transition-all"
                  >
                    {guests.every((g) => squadIds.has(g.id)) ? 'Clear' : 'All'}
                  </button>
                </div>
                <div className="px-3 pb-3 flex flex-wrap gap-2">
                  {guests.filter(matchesSearch).map((g) => (
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

            {query && !teams.some((t) => t.players.some(matchesSearch)) && !guests.some(matchesSearch) && (
              <button
                onClick={() => { openAddSheet(); setNewName(search.trim()); }}
                className="w-full text-center text-sm text-gold font-semibold py-3 rounded-2xl border border-dashed border-gold/30"
              >
                No “{search.trim()}” — add as new player
              </button>
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
                      Fair {genType === 2 ? '2-Team' : '3-Team'} Split
                    </span>
                    {split?.recorded && (
                      <>
                        <span className="text-[9px] text-muted/50">·</span>
                        <span className="text-[9px] font-bold text-safe">Recorded</span>
                      </>
                    )}
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
                          {p.id === team.captainId && (
                            <span className={cn('text-[10px] font-black px-2 py-0.5 rounded-full border shrink-0', c.pill)}>
                              CAPTAIN
                            </span>
                          )}
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
                <div className="space-y-1.5">
                  <Button variant="gold" size="md" fullWidth onClick={() => handleStartMatch()}>
                    <Play size={15} className="mr-1.5" /> Start Match · {defaultOvers(generated[0], generated[1])} overs
                  </Button>
                  <p className="text-muted/60 text-[11px] text-center">
                    {generated[0].players.length} v {generated[1].players.length} players · overs can be changed on the next screen
                  </p>
                </div>
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
                                  {tA.players.length} v {tB.players.length} · {defaultOvers(tA, tB)} overs ·{' '}
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

      {/* ── Sticky generate bar — always in thumb reach above the bottom nav ── */}
      {!loading && !isEmpty && (
        <div className="sticky bottom-0 z-20 px-4 pt-4 pb-3 bg-gradient-to-t from-pitch via-pitch/95 to-pitch/0">
          <div className="flex items-stretch gap-2 p-1.5 rounded-[22px] bg-pitch-light/95 border border-white/[0.08] shadow-[0_8px_24px_0_rgb(0_0_0/0.35)] backdrop-blur">
            {/* Team count — choose first, then one clear action */}
            <div className="flex flex-col justify-center gap-1 rounded-2xl bg-pitch-dark p-1" role="radiogroup" aria-label="Number of teams">
              {([2, 3] as const).map((n) => {
                const enabled = n === 2 ? canGen2 : canGen3;
                const selected = barCount === n;
                return (
                  <button
                    key={n}
                    role="radio"
                    aria-checked={selected}
                    disabled={!enabled}
                    onClick={() => selectTeamCount(n)}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 min-h-[30px] rounded-xl text-xs font-black transition-all',
                      selected ? 'bg-gold/20 text-gold' : 'text-muted hover:text-white',
                      !enabled && 'opacity-30 cursor-not-allowed',
                    )}
                  >
                    <TeamCountDots n={n} active={selected} />
                    {n} teams
                  </button>
                );
              })}
            </div>

            {/* Primary action */}
            <button
              disabled={!canSplit}
              onClick={() => handleGenerate(barCount)}
              className={cn(
                'relative flex-1 overflow-hidden rounded-2xl flex items-center gap-3 px-4 min-h-[64px] text-left transition-all active:scale-[0.98]',
                canSplit
                  ? 'bg-gradient-to-r from-gold via-gold-light to-gold text-[#1a0e04] shadow-[0_0_20px_0_rgb(var(--color-gold)/0.3)]'
                  : 'bg-pitch-dark text-muted/40 cursor-not-allowed',
              )}
            >
              {isReshuffle ? <RefreshCw size={20} className="shrink-0" /> : <Shuffle size={20} className="shrink-0" />}
              <span className="min-w-0">
                <span className="block font-black text-base leading-tight">
                  {isReshuffle ? 'Reshuffle' : `Split into ${barCount} teams`}
                </span>
                <span className={cn('block text-[11px] font-semibold leading-tight mt-0.5 truncate', canSplit ? 'text-[#1a0e04]/70' : 'text-muted/50')}>
                  {canSplit
                    ? `${squadPlayers.length} players → ${teamSizePreview(squadPlayers.length, barCount)}`
                    : `Pick at least ${barCount} players`}
                </span>
              </span>
            </button>
          </div>
        </div>
      )}

      <Modal isOpen={showResetHistory} onClose={() => setShowResetHistory(false)} title="Reset fairness history?">
        <p className="text-muted text-sm mb-4 leading-relaxed">
          Clears captain counts, cooldowns and top-half history for everyone. Match stats are not affected.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" size="lg" fullWidth onClick={() => setShowResetHistory(false)}>Cancel</Button>
          <Button variant="danger" size="lg" fullWidth onClick={handleResetHistory}>Reset</Button>
        </div>
      </Modal>

      {/* ── Captain fairness sheet ── */}
      <Modal isOpen={showFairness && !!history} onClose={() => setShowFairness(false)} title="Captain fairness">
        {history && (
          <FairnessPanel
            history={history}
            players={squadPlayers.length ? squadPlayers.filter((p) => roster.isRosterId(p.id)) : [...new Map(savedPlayers.map((p) => [p.id, p])).values()]}
            scopeLabel={squadPlayers.length ? "Today's squad" : 'Whole club'}
            onImport={() => historyFileRef.current?.click()}
            onExport={handleExportHistory}
            onReset={() => setShowResetHistory(true)}
          />
        )}
      </Modal>
      <input ref={historyFileRef} type="file" accept=".json,application/json" className="sr-only" onChange={handleImportHistory} />

      {/* ── Add player sheet ── */}
      <Modal isOpen={!!addTarget} onClose={closeAddSheet} title="Add Player">
        <input
          autoFocus
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAddPlayer()}
          placeholder="Player name"
          className="w-full bg-pitch-dark border border-white/[0.08] rounded-2xl px-4 py-3 text-white placeholder-muted/40 focus:outline-none focus:ring-2 focus:ring-gold/40 mb-3 text-sm"
        />
        <p className="text-[11px] text-muted font-semibold mb-2">Save to</p>
        <div className="flex flex-wrap gap-2 mb-2">
          {teams.map((t) => (
            <button
              key={t.id}
              onClick={() => setAddTarget(t.id)}
              className={cn(
                'px-3 py-2 rounded-xl border text-sm font-semibold transition-all',
                addTarget === t.id ? 'bg-gold/15 border-gold/50 text-gold' : 'bg-pitch-dark border-white/[0.08] text-muted',
              )}
            >
              {t.name}
            </button>
          ))}
          <button
            onClick={() => setAddTarget(GUEST)}
            className={cn(
              'px-3 py-2 rounded-xl border text-sm font-semibold transition-all',
              addTarget === GUEST ? 'bg-wide/15 border-wide/50 text-wide' : 'bg-pitch-dark border-white/[0.08] text-muted',
            )}
          >
            Guest · today only
          </button>
        </div>
        <p className="text-muted/70 text-[11px] leading-relaxed mb-4">
          {addTarget === GUEST
            ? 'Guests can play today but their stats are not kept.'
            : 'Saved to the club roster — stats count. They are picked for today straight away.'}
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" size="lg" fullWidth onClick={closeAddSheet}>Done</Button>
          <Button variant="gold" size="lg" fullWidth disabled={!newName.trim()} onClick={handleAddPlayer}>
            Add
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

      // Player name — truncate if needed; captain marked like a scorecard
      const maxNameW = tw - 56;
      const fullName = p.id === team.captainId ? `${p.name} (c)` : p.name;
      let name = fullName;
      ctx.font = `600 14px system-ui, -apple-system, sans-serif`;
      while (ctx.measureText(name).width > maxNameW && name.length > 3) {
        name = name.slice(0, -1);
      }
      if (name !== fullName) name += '…';
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

// ─── TeamCountDots ────────────────────────────────────────────────────────────

/** Tiny team-colour dots: a visual hint of how many teams the split makes. */
function TeamCountDots({ n, active }: { n: 2 | 3; active: boolean }) {
  return (
    <span className="flex gap-0.5" aria-hidden>
      {TEAM_COLORS.slice(0, n).map((c) => (
        <span key={c.hex} className={cn('w-1.5 h-1.5 rounded-full', active ? c.dot : 'bg-muted/40')} />
      ))}
    </span>
  );
}

// ─── FairnessPanel ────────────────────────────────────────────────────────────

function FairnessPanel({
  history, players, scopeLabel, onImport, onExport, onReset,
}: {
  history: FairnessHistory;
  players: GenPlayer[];
  scopeLabel: string;
  onImport: () => void;
  onExport: () => void;
  onReset: () => void;
}) {
  const rows = players
    .map((p) => {
      const h = recordFor(history, p.id);
      return {
        ...p,
        captain: h.firstCount,
        topPct: h.totalDraws ? Math.round((h.topDraws / h.totalDraws) * 100) : null,
        cooldown: cooldownRemaining(history, p.id),
      };
    })
    .sort((a, b) => a.captain - b.captain || a.cooldown - b.cooldown || a.name.localeCompare(b.name));

  return (
    <div className="space-y-3 pb-1">
      <div className="flex gap-2">
        <div className="flex-1 bg-pitch-dark rounded-xl px-3 py-2">
          <p className="text-gold font-black text-lg leading-none">{history.generation}</p>
          <p className="text-muted text-[10px] mt-1">Matches recorded</p>
        </div>
        <div className="flex-1 bg-pitch-dark rounded-xl px-3 py-2">
          <p className="text-white font-black text-lg leading-none">{rows.filter((r) => !r.cooldown).length}</p>
          <p className="text-muted text-[10px] mt-1">Ready to captain</p>
        </div>
      </div>
      <p className="text-[11px] text-muted leading-relaxed">
        Captain = fewest captaincies, skipping anyone who captained in the last {COOLDOWN_GENS} matches.
        The rest of the order favours players who were low in the list before. History only updates when
        you press <span className="text-white font-semibold">Start Match</span> — reshuffles never count.
      </p>
      {rows.length > 0 && (
        <div className="space-y-1">
          <div className="grid grid-cols-[1fr_44px_52px_56px] gap-2 text-[10px] text-muted/60 font-bold uppercase tracking-wide px-1">
            <span>{scopeLabel}</span><span className="text-right">Capt</span><span className="text-right">Top ½</span><span className="text-right">Next C</span>
          </div>
          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {rows.map((r) => (
              <div key={r.id} className="grid grid-cols-[1fr_44px_52px_56px] gap-2 items-center text-xs px-1 py-1.5 rounded-lg odd:bg-black/[0.04]">
                <span className="text-white font-semibold truncate">{r.name}</span>
                <span className="text-right text-gold font-bold">{r.captain}×</span>
                <span className="text-right text-muted">{r.topPct === null ? '—' : `${r.topPct}%`}</span>
                <span className={cn('text-right font-semibold', r.cooldown ? 'text-amber' : 'text-safe')}>
                  {r.cooldown ? `in ${r.cooldown}` : 'Ready'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-2">
        <Button variant="secondary" size="sm" fullWidth onClick={onImport}>
          <Upload size={13} className="mr-1" /> Import
        </Button>
        <Button variant="secondary" size="sm" fullWidth onClick={onExport}>
          <Download size={13} className="mr-1" /> Export
        </Button>
        <Button variant="ghost" size="sm" fullWidth onClick={onReset}>Reset</Button>
      </div>
    </div>
  );
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

function EmptyPool({ onAdd, onGoToTeams }: { onAdd: () => void; onGoToTeams: () => void }) {
  return (
    <div className="relative overflow-hidden bg-pitch-light rounded-3xl p-8 text-center border border-white/[0.05]">
      <div className="h-[2px] bg-gradient-to-r from-transparent via-gold/30 to-transparent absolute inset-x-0 top-0" />
      <div className="w-16 h-16 rounded-2xl bg-gold/10 border border-gold/20 flex items-center justify-center mx-auto mb-4">
        <Zap size={28} className="text-gold/60" />
      </div>
      <p className="text-white font-black text-lg mb-1.5">No players yet</p>
      <p className="text-muted/70 text-sm mb-6 leading-relaxed max-w-[260px] mx-auto">
        Add your club players here — they are saved to the roster so their stats count.
      </p>
      <div className="flex flex-col gap-2 items-center">
        <Button variant="gold" size="md" onClick={onAdd}>
          <Plus size={15} className="mr-1" /> Add Player
        </Button>
        <button onClick={onGoToTeams} className="text-muted text-xs font-semibold py-2 hover:text-white">
          Manage squads in Teams →
        </button>
      </div>
    </div>
  );
}
