import { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Trash2, ChevronRight, Search, Download, Upload, Trophy, Clock, X } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { useMatch } from '@/hooks/useMatch';
import { useUIStore } from '@/store/uiStore';
import { formatDate } from '@/utils/format';
import { db } from '@/db/database';
import { saveMatch } from '@/db/repos/matchRepo';
import { saveInnings } from '@/db/repos/inningsRepo';
import { addDelivery } from '@/db/repos/playerRepo';
import type { Match, Innings } from '@/types/match.types';
import type { Delivery } from '@/types/delivery.types';
import { cn } from '@/utils/cn';

type StatusFilter = 'all' | 'in_progress' | 'completed';

function matchesSearch(m: Match, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  if (m.name.toLowerCase().includes(q)) return true;
  for (const team of m.teams) {
    if (team.name.toLowerCase().includes(q)) return true;
    for (const player of team.players) {
      if (player.name.toLowerCase().includes(q)) return true;
    }
  }
  return false;
}

function dateGroup(ts: number): string {
  const now   = new Date();
  const d     = new Date(ts);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const diff  = today - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days  = Math.round(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days <= 7)  return 'This Week';
  if (days <= 30) return 'This Month';
  return 'Earlier';
}

const GROUP_ORDER = ['Today', 'Yesterday', 'This Week', 'This Month', 'Earlier'];

// ─── Match Card ───────────────────────────────────────────────────────────────

function MatchCard({
  m, onNavigate, onDelete, onSwiped,
}: { m: Match; onNavigate: () => void; onDelete: () => void; onSwiped?: () => void }) {
  const [swipeX, setSwipeX]   = useState(0);
  const [revealed, setRevealed] = useState(false);
  const touchStartX   = useRef(0);
  const touchStartY   = useRef(0);
  const isScrolling   = useRef<boolean | null>(null);
  const THRESHOLD     = 76;

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current   = e.touches[0].clientX;
    touchStartY.current   = e.touches[0].clientY;
    isScrolling.current   = null;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const dx = e.touches[0].clientX - touchStartX.current;
    const dy = e.touches[0].clientY - touchStartY.current;
    if (isScrolling.current === null) isScrolling.current = Math.abs(dy) > Math.abs(dx);
    if (isScrolling.current) return;
    const clamped = Math.max(-THRESHOLD, Math.min(0, dx + (revealed ? -THRESHOLD : 0)));
    setSwipeX(clamped);
  };

  const handleTouchEnd = () => {
    if (isScrolling.current) return;
    if (swipeX < -THRESHOLD / 2) { setSwipeX(-THRESHOLD); setRevealed(true); onSwiped?.(); }
    else { setSwipeX(0); setRevealed(false); }
  };

  const handleCardClick = () => {
    if (revealed) { setSwipeX(0); setRevealed(false); return; }
    onNavigate();
  };

  const isCompleted = m.status === 'completed';
  const isAbandoned = m.result?.resultText === 'Match Abandoned';
  const isLive      = !isCompleted;
  const hasWinner   = !!m.result?.winnerId;
  const winnerTeam  = hasWinner ? m.teams.find((t) => t.id === m.result!.winnerId) : null;
  const isTie       = isCompleted && !hasWinner && !isAbandoned;

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Delete zone */}
      <div className="absolute inset-y-0 right-0 w-[76px] flex items-center justify-center bg-wicket rounded-2xl">
        <button onClick={onDelete} className="flex flex-col items-center gap-1 text-white" aria-label="Delete match">
          <Trash2 size={18} />
          <span className="text-[10px] font-bold">Delete</span>
        </button>
      </div>

      {/* Card */}
      <div
        className={cn(
          'relative rounded-2xl overflow-hidden bg-pitch-light border transition-transform will-change-transform',
          isLive
            ? 'border-gold/25'
            : hasWinner
              ? 'border-white/[0.06]'
              : isTie
                ? 'border-safe/20'
                : 'border-white/[0.06]',
        )}
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Top accent bar — gold for live/win, safe for tie, nothing for abandoned */}
        {isLive && (
          <div className="h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent" />
        )}
        {isCompleted && hasWinner && (
          <div className="h-[2px] bg-gradient-to-r from-transparent via-gold/40 to-transparent" />
        )}
        {isTie && (
          <div className="h-[2px] bg-gradient-to-r from-transparent via-safe/50 to-transparent" />
        )}

        <button className="w-full text-left px-4 py-3.5" onClick={handleCardClick}>
          <div className="flex items-start gap-3">
            {/* Status icon */}
            <div className={cn(
              'mt-0.5 w-8 h-8 rounded-xl shrink-0 flex items-center justify-center',
              isLive      ? 'bg-gold/15' :
              hasWinner   ? 'bg-gold/10' :
              isTie       ? 'bg-safe/10' :
                            'bg-pitch-dark',
            )}>
              {isLive ? (
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-gold opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-gold" />
                </span>
              ) : hasWinner ? (
                <Trophy size={14} className="text-gold" />
              ) : isTie ? (
                <span className="text-safe text-[11px] font-black">=</span>
              ) : (
                <span className="text-muted/40 text-[10px] font-black">✗</span>
              )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
              {/* Match name */}
              <p className="font-black text-white text-sm leading-tight truncate">
                {m.name}
              </p>
              {/* Teams */}
              <p className="text-muted text-xs mt-0.5 truncate">
                {m.teams[0].name}
                <span className="text-muted/40 mx-1">vs</span>
                {m.teams[1].name}
              </p>

              {/* Result line */}
              <div className="mt-1.5">
                {isLive ? (
                  <span className="inline-flex items-center gap-1 text-[10px] font-black text-gold bg-gold/10 border border-gold/25 rounded-full px-2 py-0.5 leading-none">
                    <span className="w-1.5 h-1.5 rounded-full bg-gold" />
                    LIVE
                  </span>
                ) : isAbandoned ? (
                  <span className="inline-flex items-center text-[10px] font-bold text-muted/60 bg-pitch-dark border border-white/[0.06] rounded-full px-2 py-0.5 leading-none">
                    Abandoned
                  </span>
                ) : winnerTeam ? (
                  <p className="text-xs font-bold text-gold truncate">{m.result!.resultText}</p>
                ) : isTie ? (
                  <p className="text-xs font-bold text-safe">Match Tied</p>
                ) : (
                  <p className="text-xs text-muted/60">Completed</p>
                )}
              </div>

              {/* Meta */}
              <p className="text-muted/50 text-[10px] mt-1.5 font-mono">
                {formatDate(m.createdAt)}
                <span className="mx-1 opacity-50">·</span>
                {m.config.overs} overs
                <span className="mx-1 opacity-50">·</span>
                {m.config.playersPerSide}v{m.config.playersPerSide}
              </p>
            </div>

            {/* Chevron */}
            <ChevronRight
              size={15}
              className={cn('shrink-0 mt-2 transition-colors', revealed ? 'text-muted/20' : 'text-muted/40')}
            />
          </div>
        </button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  const navigate  = useNavigate();
  const { matches, loading, loadMatches, removeMatch } = useMatch();
  const { addToast } = useUIStore();

  const [search, setSearch]             = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [deleteTarget, setDeleteTarget] = useState<Match | null>(null);
  const [deleting, setDeleting]         = useState(false);
  const [importing, setImporting]       = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadMatches(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => matches.filter((m) => {
    if (statusFilter === 'completed'   && m.status !== 'completed') return false;
    if (statusFilter === 'in_progress' && m.status === 'completed') return false;
    return matchesSearch(m, search.trim());
  }), [matches, statusFilter, search]);

  // Group by date period
  const grouped = useMemo(() => {
    const map = new Map<string, Match[]>();
    for (const m of filtered) {
      const g = dateGroup(m.createdAt);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(m);
    }
    return GROUP_ORDER.filter((g) => map.has(g)).map((g) => ({ label: g, matches: map.get(g)! }));
  }, [filtered]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    await removeMatch(deleteTarget.id);
    setDeleting(false);
    setDeleteTarget(null);
    addToast('Match deleted', 'success');
  };

  const handleExport = async () => {
    const allInnings   = await db.innings.toArray();
    const allDeliveries = await db.deliveries.toArray();
    const payload = { version: 1, matches, innings: allInnings, deliveries: allDeliveries };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `cricket-matches-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    addToast(`Exported ${matches.length} match${matches.length !== 1 ? 'es' : ''}`, 'success');
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const data = JSON.parse(await file.text()) as {
        version?: number; matches: Match[]; innings?: Innings[]; deliveries?: Delivery[];
      };
      if (!Array.isArray(data.matches)) throw new Error('Invalid file');
      let count = 0;
      for (const m of data.matches) { if (m.id && m.name) { await saveMatch(m); count++; } }
      for (const i of data.innings  ?? []) { if (i.id) await saveInnings(i); }
      for (const d of data.deliveries ?? []) {
        if (d.id && !(await db.deliveries.get(d.id))) await addDelivery(d);
      }
      await loadMatches();
      addToast(`Imported ${count} match${count !== 1 ? 'es' : ''}`, 'success');
    } catch {
      addToast('Import failed — invalid file format', 'error');
    } finally {
      setImporting(false);
    }
  };

  const liveCount      = matches.filter((m) => m.status !== 'completed').length;
  const completedCount = matches.filter((m) => m.status === 'completed').length;

  const FILTERS: { label: string; value: StatusFilter; count?: number }[] = [
    { label: 'All',         value: 'all',         count: matches.length   },
    { label: 'Live',        value: 'in_progress',  count: liveCount        },
    { label: 'Completed',   value: 'completed',    count: completedCount   },
  ];

  return (
    <div className="min-h-screen bg-pitch flex flex-col">
      <TopBar
        title="Match History"
        showThemeToggle
        actions={
          <div className="flex items-center gap-1">
            <button
              onClick={handleExport}
              disabled={matches.length === 0}
              title="Export backup"
              className="w-9 h-9 flex items-center justify-center rounded-xl text-muted hover:text-gold hover:bg-pitch-light/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Download size={17} />
            </button>
            <button
              onClick={() => importRef.current?.click()}
              disabled={importing}
              title="Import backup"
              className="w-9 h-9 flex items-center justify-center rounded-xl text-muted hover:text-gold hover:bg-pitch-light/60 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <Upload size={17} />
            </button>
            <input ref={importRef} type="file" accept=".json,application/json" className="sr-only" onChange={handleImportFile} />
          </div>
        }
      />

      {/* Search + filters */}
      <div className="px-4 pt-3 pb-2 space-y-2.5">
        {/* Search */}
        <div className="relative">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted/60 pointer-events-none" />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted/50 hover:text-muted transition-colors"
            >
              <X size={14} />
            </button>
          )}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search match, team or player…"
            className="w-full bg-pitch-dark border border-white/[0.07] rounded-2xl pl-9 pr-9 py-3 text-white placeholder-muted/40 focus:outline-none focus:ring-2 focus:ring-gold/35 text-sm transition-all"
          />
        </div>

        {/* Filter pills */}
        <div className="flex gap-1.5 bg-pitch-dark rounded-2xl p-1">
          {FILTERS.map(({ label, value, count }) => {
            const active = statusFilter === value;
            return (
              <button
                key={value}
                onClick={() => setStatusFilter(value)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-xs font-bold transition-all',
                  active
                    ? 'bg-pitch-light text-gold shadow-[0_1px_3px_rgba(0,0,0,0.25)]'
                    : 'text-muted hover:text-white',
                )}
              >
                {label}
                {count !== undefined && count > 0 && (
                  <span className={cn(
                    'text-[9px] font-black rounded-full px-1.5 py-0.5 leading-none min-w-[18px] text-center',
                    active ? 'bg-gold/20 text-gold' : 'bg-white/[0.06] text-muted/60',
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Swipe hint */}
      {!loading && filtered.length > 0 && (
        <p className="text-muted/35 text-[10px] text-center pb-1 select-none">
          ← swipe left to delete
        </p>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex-1 px-4 pt-1 space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-pitch-light rounded-2xl px-4 py-3.5 animate-pulse">
              <div className="flex gap-3">
                <div className="w-8 h-8 rounded-xl bg-pitch-dark shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-pitch-dark rounded-lg w-3/4" />
                  <div className="h-3 bg-pitch-dark rounded-lg w-1/2 opacity-60" />
                  <div className="h-3 bg-pitch-dark rounded-lg w-1/3 opacity-40" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState search={search} filter={statusFilter} onClear={() => { setSearch(''); setStatusFilter('all'); }} onNew={() => navigate('/new-match')} />
      ) : (
        <div className="flex-1 overflow-y-auto px-4 pb-6 pt-1 space-y-5">
          {grouped.map(({ label, matches: groupMatches }) => (
            <div key={label}>
              {/* Date group label */}
              <div className="flex items-center gap-3 mb-2 px-1">
                <span className="text-[10px] font-black text-muted/50 uppercase tracking-[2px]">{label}</span>
                <div className="flex-1 h-px bg-pitch-dark" />
                <span className="text-[10px] font-bold text-muted/30">{groupMatches.length}</span>
              </div>
              <div className="space-y-2">
                {groupMatches.map((m) => (
                  <MatchCard
                    key={m.id}
                    m={m}
                    onNavigate={() => navigate(m.status === 'completed' ? `/match/${m.id}/scorecard` : `/match/${m.id}/scoring`)}
                    onDelete={() => setDeleteTarget(m)}
                    onSwiped={() => {}}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete confirmation */}
      <Modal isOpen={!!deleteTarget} onClose={() => setDeleteTarget(null)} title="Delete Match?">
        <div className="text-center mb-5">
          <div className="w-14 h-14 rounded-2xl bg-wicket/15 border border-wicket/25 flex items-center justify-center mx-auto mb-4">
            <Trash2 size={22} className="text-wicket" />
          </div>
          <p className="text-muted/80 text-sm leading-relaxed">
            Permanently delete{' '}
            <span className="text-white font-bold">
              {deleteTarget?.teams[0].name} vs {deleteTarget?.teams[1].name}
            </span>
            ? This cannot be undone.
          </p>
        </div>
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => setDeleteTarget(null)}>Cancel</Button>
          <Button variant="danger" fullWidth loading={deleting} onClick={handleDelete}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({
  search, filter, onClear, onNew,
}: { search: string; filter: StatusFilter; onClear: () => void; onNew: () => void }) {
  const hasFilters = !!search || filter !== 'all';
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-8 text-center gap-4 pb-16">
      <div className="w-20 h-20 rounded-3xl bg-pitch-light border border-white/[0.06] flex items-center justify-center mb-2">
        {hasFilters
          ? <Search size={32} className="text-muted/40" />
          : <Clock size={32} className="text-muted/40" />}
      </div>
      <div>
        <p className="font-black text-white text-lg mb-1">
          {hasFilters ? 'No matches found' : 'No matches yet'}
        </p>
        <p className="text-muted/60 text-sm leading-relaxed max-w-[260px] mx-auto">
          {hasFilters
            ? 'Try a different search or clear the filters'
            : 'Your completed and in-progress matches will appear here'}
        </p>
      </div>
      {hasFilters ? (
        <Button variant="secondary" size="md" onClick={onClear}>Clear filters</Button>
      ) : (
        <Button variant="gold" size="md" onClick={onNew}>Start a Match</Button>
      )}
    </div>
  );
}
