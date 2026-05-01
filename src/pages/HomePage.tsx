import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PlusCircle, Play, Share2, ClipboardList, Sun, Moon, ChevronRight, RotateCcw, Zap, BarChart2, Send } from 'lucide-react';
import { useMatch } from '@/hooks/useMatch';
import { Button } from '@/components/common/Button';
import { formatDate } from '@/utils/format';
import type { Match } from '@/types/match.types';
import { buildShareText, shareScorecard } from '@/utils/share';
import { getMatchInnings } from '@/db/repos/inningsRepo';
import { getInningsDeliveries } from '@/db/repos/playerRepo';
import { computeInningsStats } from '@/utils/cricket';
import { useUIStore } from '@/store/uiStore';
import { useTheme } from '@/hooks/useTheme';
import { cn } from '@/utils/cn';

// ─── Types ────────────────────────────────────────────────────────────────────

type MatchScore = { runs: number; wickets: number; legalBalls: number; teamId: string };
type LoadedMatchData = { inn1?: MatchScore; inn2?: MatchScore };
type LiveScore = MatchScore & { inningsNumber: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isAllOut(wickets: number, match: Match): boolean {
  return match.rules.lastManStands
    ? wickets >= match.config.playersPerSide
    : wickets >= match.config.playersPerSide - 1;
}

function scoreLabel(s: MatchScore, match: Match): string {
  if (s.legalBalls === 0) return '—';
  return isAllOut(s.wickets, match) ? `${s.runs}` : `${s.runs}/${s.wickets}`;
}

function oversLabel(legalBalls: number): string {
  if (legalBalls === 0) return '';
  return `(${Math.floor(legalBalls / 6)}.${legalBalls % 6} ov)`;
}

// ─── AppHeader ────────────────────────────────────────────────────────────────

function AppHeader() {
  const { isDark, toggle } = useTheme();
  return (
    <div className="
      sticky top-0 z-30 flex items-center px-4 py-3 gap-3 min-h-[56px]
      glass border-b border-white/[0.06]
      shadow-[0_1px_0_0_rgb(255_255_255/0.04),0_2px_8px_0_rgb(0_0_0/0.3)]
    ">
      <span className="select-none shrink-0 text-[24px] leading-none">🏏</span>
      <div className="flex-1 min-w-0 flex items-baseline gap-2">
        <span className="font-display text-2xl leading-none tracking-widest shimmer-gold">CRICSCORE</span>
        <span className="text-muted text-[10px] font-bold uppercase tracking-wider leading-none hidden xs:inline">Street Cricket Scorer</span>
      </div>
      <button
        onClick={toggle}
        className="shrink-0 flex items-center justify-center w-9 h-9 rounded-xl text-muted hover:text-gold hover:bg-pitch-light/60 transition-all"
        aria-label="Toggle theme"
      >
        {isDark ? <Sun size={17} /> : <Moon size={17} />}
      </button>
    </div>
  );
}

// ─── WelcomeScreen ────────────────────────────────────────────────────────────

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex-1 flex flex-col px-4 pb-8">
      {/* Hero visual */}
      <div className="flex-1 flex flex-col items-center justify-center text-center py-6 min-h-[240px]">
        <div className="relative mb-5">
          {/* Double glow */}
          <div className="absolute -inset-8 rounded-full bg-gold/10 blur-3xl" />
          <div className="absolute -inset-5 rounded-full bg-grass/30 blur-2xl" />
          <span
            className="relative select-none"
            style={{ fontSize: '80px', lineHeight: 1 }}
            role="img"
            aria-label="cricket bat"
          >
            🏏
          </span>
        </div>
        <h1 className="font-display text-5xl text-white tracking-wider leading-none mb-0.5">
          STREET CRICKET
        </h1>
        <h1 className="font-display text-5xl tracking-wider leading-none mb-4 shimmer-gold">
          SCORER
        </h1>
        <p className="text-muted text-sm font-medium max-w-[240px] leading-relaxed">
          Ball-by-ball scoring for your gully cricket matches — live stats, instant sharing, no internet needed.
        </p>
      </div>

      {/* Feature pills — coloured icon accent per feature */}
      <div className="grid grid-cols-3 gap-2 mb-5">
        {[
          { Icon: Zap,      title: 'Quick Setup', sub: '2 minutes',  bg: 'bg-gold/15',  icon: 'text-gold'  },
          { Icon: BarChart2, title: 'Live Stats',  sub: 'Every ball', bg: 'bg-runs/15',  icon: 'text-runs'  },
          { Icon: Send,     title: 'Share',        sub: 'WhatsApp',   bg: 'bg-four/15',  icon: 'text-four'  },
        ].map((f) => (
          <div
            key={f.title}
            className="relative bg-pitch-light rounded-2xl py-4 px-2 text-center overflow-hidden border border-white/[0.04]"
          >
            {/* Subtle top shimmer line */}
            <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
            <div className={`inline-flex items-center justify-center w-9 h-9 rounded-xl mb-2 ${f.bg}`}>
              <f.Icon size={17} className={f.icon} strokeWidth={2.5} />
            </div>
            <p className="text-white font-bold text-xs leading-tight">{f.title}</p>
            <p className="text-muted text-[10px] mt-0.5">{f.sub}</p>
          </div>
        ))}
      </div>

      <Button variant="gold" size="xl" fullWidth onClick={onStart}>
        <PlusCircle size={20} className="mr-2 shrink-0" /> Start First Match
      </Button>

      <p className="text-muted/40 text-[11px] text-center mt-3">
        Works fully offline · No account needed
      </p>
    </div>
  );
}

// ─── LiveMatchBanner ──────────────────────────────────────────────────────────

function LiveMatchBanner({
  match,
  liveScore,
  onResume,
}: {
  match: Match;
  liveScore: LiveScore | null;
  onResume: () => void;
}) {
  const battingTeam = liveScore ? match.teams.find((t) => t.id === liveScore.teamId) : null;
  const bowlingTeam = liveScore ? match.teams.find((t) => t.id !== liveScore.teamId) : null;
  const inningsLabel = match.status === 'innings_1' ? '1st Innings' : match.status === 'innings_2' ? '2nd Innings' : '';

  return (
    <div className="relative overflow-hidden rounded-3xl mx-4 edge-lit">
      {/* Gold top highlight line */}
      <div className="absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-gold/60 to-transparent z-10" />

      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-grass/70 via-pitch-light to-pitch-dark" />

      {/* Field SVG */}
      <svg
        className="absolute inset-0 w-full h-full opacity-[0.06] pointer-events-none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden
      >
        <ellipse cx="50%" cy="50%" rx="45%" ry="38%" fill="none" stroke="white" strokeWidth="1.5" />
        <ellipse cx="50%" cy="50%" rx="28%" ry="22%" fill="none" stroke="white" strokeWidth="1" />
        <line x1="50%" y1="0" x2="50%" y2="100%" stroke="white" strokeWidth="0.8" />
        <line x1="0" y1="50%" x2="100%" y2="50%" stroke="white" strokeWidth="0.8" />
      </svg>

      <div className="relative p-5">
        {/* Live indicator row */}
        <div className="flex items-center gap-2 mb-4">
          {/* Pulsing live dot — green (safe token = online/live convention) */}
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-safe opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-safe" />
          </span>
          <span className="text-white text-[11px] font-black uppercase tracking-widest">
            Live Match
          </span>
          {inningsLabel && (
            <span className="ml-auto bg-pitch-dark/60 text-muted rounded-full px-2.5 py-0.5 text-xs">
              {inningsLabel}
            </span>
          )}
        </div>

        {liveScore ? (
          /* Score display when innings data loaded */
          <div className="mb-4">
            <p className="text-muted text-xs font-semibold mb-1">
              {battingTeam?.name ?? '?'} batting
            </p>
            <div className="flex items-end gap-3">
              <span className="font-display text-5xl text-white leading-none">
                {isAllOut(liveScore.wickets, match) ? liveScore.runs : `${liveScore.runs}/${liveScore.wickets}`}
              </span>
              <span className="text-muted text-sm font-mono mb-1">
                {oversLabel(liveScore.legalBalls)}
              </span>
            </div>
            {bowlingTeam && (
              <p className="text-muted/70 text-[11px] mt-1">{bowlingTeam.name} bowling</p>
            )}
          </div>
        ) : (
          /* Teams vs layout when no live score yet */
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1 bg-pitch-dark rounded-2xl py-3 px-3 text-center border border-pitch-light/40">
              <p className="text-white font-black text-sm leading-tight truncate">{match.teams[0].name}</p>
            </div>
            <div className="shrink-0 text-center">
              <p className="text-gold font-display text-xl leading-none tracking-wider">VS</p>
            </div>
            <div className="flex-1 bg-pitch-dark rounded-2xl py-3 px-3 text-center border border-pitch-light/40">
              <p className="text-white font-black text-sm leading-tight truncate">{match.teams[1].name}</p>
            </div>
          </div>
        )}

        <Button variant="gold" size="lg" fullWidth onClick={onResume}>
          <Play size={17} className="mr-2" /> Resume Match
        </Button>
      </div>
    </div>
  );
}

// ─── LastMatchCard ────────────────────────────────────────────────────────────

function LastMatchCard({
  match,
  scores,
  onScorecard,
  onShare,
  onRematch,
}: {
  match: Match;
  scores: LoadedMatchData;
  onScorecard: () => void;
  onShare: () => void;
  onRematch: () => void;
}) {
  const hasWinner = !!match.result?.winnerId;
  const winnerId = match.result?.winnerId ?? null;

  const renderTeamRow = (teamIndex: 0 | 1) => {
    const team = match.teams[teamIndex];
    const score = teamIndex === 0 ? scores.inn1 : scores.inn2;
    // Also check if team batted in innings 1 or 2
    const inn1Score = scores.inn1?.teamId === team.id ? scores.inn1 : undefined;
    const inn2Score = scores.inn2?.teamId === team.id ? scores.inn2 : undefined;
    const teamScore = inn1Score ?? inn2Score;
    const isWinner = winnerId === team.id;
    // suppress unused
    void score;

    return (
      <div
        key={team.id}
        className={cn(
          'rounded-xl px-3 py-2.5',
          isWinner
            ? 'bg-gold/10 border border-gold/20'
            : 'bg-pitch-dark',
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {isWinner && <span className="text-gold text-sm shrink-0">★</span>}
            <p className="font-black text-sm truncate text-white">{team.name}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {teamScore && teamScore.legalBalls > 0 ? (
              <>
                <span className={cn('font-display text-xl leading-none', isWinner ? 'text-gold' : 'text-white')}>
                  {scoreLabel(teamScore, match)}
                </span>
                <span className="text-muted text-[10px] font-mono">
                  {oversLabel(teamScore.legalBalls)}
                </span>
              </>
            ) : (
              <span className="text-muted text-sm">—</span>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="mx-4 rounded-2xl overflow-hidden bg-pitch-light border border-pitch-light/60 edge-lit">
      {/* Accent strip */}
      <div className={cn(
        'h-[3px] w-full',
        hasWinner
          ? 'bg-gradient-to-r from-gold/60 via-gold to-gold/60'
          : 'bg-muted/20',
      )} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start justify-between mb-3">
          <p className="text-[10px] text-muted font-black uppercase tracking-widest">Last Match</p>
          <p className="text-muted/60 text-[10px]">{formatDate(match.createdAt)}</p>
        </div>

        {/* Team score rows */}
        <div className="space-y-2 mb-3">
          {renderTeamRow(0)}
          {renderTeamRow(1)}
        </div>

        {/* Result text */}
        {match.result?.resultText && (
          <p className={cn(
            'text-xs text-center border-b border-pitch-light/50 pb-3 mb-3',
            hasWinner ? 'text-gold font-bold' : 'text-muted',
          )}>
            {match.result.resultText}
          </p>
        )}

        {/* Three action buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={onScorecard}
            className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-[11px] font-bold bg-pitch-dark border border-white/[0.08] text-muted hover:text-white hover:border-white/20 hover:bg-pitch-dark/80 transition-all active:scale-[0.97]"
          >
            <ClipboardList size={15} className="shrink-0" />
            Scorecard
          </button>
          <button
            onClick={onRematch}
            className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-[11px] font-bold bg-gold/15 border border-gold/40 text-gold hover:bg-gold/22 transition-all active:scale-[0.97] shadow-[0_0_12px_0_rgb(var(--color-gold)/0.15)]"
          >
            <RotateCcw size={15} className="shrink-0" />
            Rematch
          </button>
          <button
            onClick={onShare}
            className="flex flex-col items-center justify-center gap-1.5 py-3 rounded-xl text-[11px] font-bold bg-pitch-dark border border-white/[0.08] text-muted hover:text-white hover:border-white/20 hover:bg-pitch-dark/80 transition-all active:scale-[0.97]"
          >
            <Share2 size={15} className="shrink-0" />
            Share
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── RecentMatchRow ────────────────────────────────────────────────────────────

function RecentMatchRow({
  match,
  scores,
  onClick,
}: {
  match: Match;
  scores?: LoadedMatchData;
  onClick: () => void;
}) {
  const hasWinner = !!match.result?.winnerId;

  // Build compact dual score string e.g. "87/4 · 72"
  const dualScore = (() => {
    if (!scores) return null;
    const parts: string[] = [];
    if (scores.inn1 && scores.inn1.legalBalls > 0) {
      parts.push(scoreLabel(scores.inn1, match));
    }
    if (scores.inn2 && scores.inn2.legalBalls > 0) {
      parts.push(scoreLabel(scores.inn2, match));
    }
    return parts.length > 0 ? parts.join(' · ') : null;
  })();

  return (
    <button
      onClick={onClick}
      className="w-full bg-pitch-light rounded-2xl px-4 py-3 text-left flex items-center gap-3 hover:bg-pitch-light/80 active:scale-[0.99] transition-all group border border-white/[0.07] hover:border-white/[0.14]"
    >
      {/* Left accent bar */}
      <div className={cn(
        'w-1.5 h-7 rounded-full shrink-0',
        hasWinner ? 'bg-gold/70' : 'bg-muted/25',
      )} />

      <div className="flex-1 min-w-0">
        <p className="font-bold text-white text-sm truncate leading-tight">
          {match.teams[0].name} vs {match.teams[1].name}
        </p>
        {match.result?.resultText ? (
          <p className={cn('text-xs font-semibold mt-0.5 truncate', hasWinner ? 'text-gold/80' : 'text-muted')}>
            {match.result.resultText}
          </p>
        ) : (
          <p className="text-muted text-xs mt-0.5">
            {formatDate(match.createdAt)} · {match.config.overs} ov
          </p>
        )}
      </div>

      <div className="text-right shrink-0 flex flex-col items-end gap-0.5">
        {dualScore ? (
          <p className="text-muted text-xs font-mono">{dualScore}</p>
        ) : (
          <p className="text-muted/50 text-[10px]">{formatDate(match.createdAt)}</p>
        )}
        <ChevronRight size={14} className="text-muted group-hover:text-gold transition-colors" />
      </div>
    </button>
  );
}

// ─── HomeSkeleton ──────────────────────────────────────────────────────────────

function SkeletonBlock({ h, rounded = 'rounded-2xl' }: { h: string; rounded?: string }) {
  return (
    <div className={`${h} ${rounded} bg-pitch-light overflow-hidden relative`}>
      {/* Shimmer sweep — far more premium than a flat pulse */}
      <div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.055] to-transparent"
        style={{ animation: 'shimmer 1.6s linear infinite', backgroundSize: '200% auto' }}
      />
    </div>
  );
}

function HomeSkeleton() {
  return (
    <div className="px-4 pt-3 space-y-3">
      <SkeletonBlock h="h-[190px]" rounded="rounded-3xl" />
      <SkeletonBlock h="h-[56px]" />
      <SkeletonBlock h="h-[180px]" />
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HomePage() {
  const navigate = useNavigate();
  const { matches, activeMatch, loading, loadMatches, loadActiveMatch } = useMatch();
  const { addToast } = useUIStore();

  const [liveScore, setLiveScore] = useState<LiveScore | null>(null);
  const [matchScores, setMatchScores] = useState<Record<string, LoadedMatchData>>({});

  // Phase 1 — load match store
  useEffect(() => {
    loadMatches();
    loadActiveMatch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Phase 2 — load score data once matches are ready
  useEffect(() => {
    if (loading) return;
    const completed = matches.filter((m) => m.status === 'completed').slice(0, 4);

    const loadAllScores = async () => {
      // Load live score for active match
      if (activeMatch && (activeMatch.status === 'innings_1' || activeMatch.status === 'innings_2')) {
        try {
          const innings = await getMatchInnings(activeMatch.id);
          const live = innings.find((i) => i.status === 'active') ?? innings[innings.length - 1];
          if (live) {
            const dels = await getInningsDeliveries(live.id);
            const stats = computeInningsStats(dels);
            setLiveScore({
              runs: stats.totalRuns,
              wickets: stats.wickets,
              legalBalls: stats.legalBalls,
              teamId: live.battingTeamId,
              inningsNumber: live.inningsNumber,
            });
          }
        } catch {
          // show banner without score
        }
      }

      // Load recent completed scores in parallel
      const entries = await Promise.all(
        completed.map(async (m) => {
          try {
            const innings = await getMatchInnings(m.id);
            const data: LoadedMatchData = {};
            await Promise.all(
              innings.map(async (inn) => {
                const dels = await getInningsDeliveries(inn.id);
                const stats = computeInningsStats(dels);
                const score: MatchScore = {
                  runs: stats.totalRuns,
                  wickets: stats.wickets,
                  legalBalls: stats.legalBalls,
                  teamId: inn.battingTeamId,
                };
                if (inn.inningsNumber === 1) data.inn1 = score;
                else data.inn2 = score;
              }),
            );
            return [m.id, data] as const;
          } catch {
            return [m.id, {}] as const;
          }
        }),
      );
      setMatchScores(Object.fromEntries(entries));
    };

    void loadAllScores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, activeMatch?.id]);

  const recentCompleted = matches.filter((m) => m.status === 'completed').slice(0, 4);
  const lastCompleted = recentCompleted[0] ?? null;

  const handleShareLast = async () => {
    if (!lastCompleted) return;
    try {
      const allInnings = await getMatchInnings(lastCompleted.id);
      const allPlayers = [...lastCompleted.teams[0].players, ...lastCompleted.teams[1].players];
      const resolveName = (id: string) => allPlayers.find((p) => p.id === id)?.name ?? id;
      const inn1 = allInnings.find((i) => i.inningsNumber === 1);
      const inn2 = allInnings.find((i) => i.inningsNumber === 2);
      if (!inn1) return;
      const d1 = await getInningsDeliveries(inn1.id);
      const s1 = computeInningsStats(d1, resolveName);
      const d2 = inn2 ? await getInningsDeliveries(inn2.id) : null;
      const s2 = d2 ? computeInningsStats(d2, resolveName) : null;
      const text = buildShareText(lastCompleted, inn1, s1, inn2 ?? null, s2);
      const result = await shareScorecard(text);
      if (result === 'copied') addToast('Scorecard copied to clipboard!', 'success');
      if (result === 'failed') addToast('Could not share scorecard', 'error');
    } catch {
      addToast('Could not share scorecard', 'error');
    }
  };

  const handleRematch = (match: Match) => {
    navigate('/new-match', { state: { rematch: { teams: match.teams } } });
  };

  const isFirstTime = !loading && recentCompleted.length === 0 && !activeMatch;

  return (
    <div className="min-h-screen bg-pitch flex flex-col">
      <AppHeader />

      {loading ? (
        <HomeSkeleton />
      ) : isFirstTime ? (
        <WelcomeScreen onStart={() => navigate('/new-match')} />
      ) : (
        <div className="flex-1 space-y-3 pt-3 pb-28">
          {/* Live match — takes the hero slot when present */}
          {activeMatch && (
            <LiveMatchBanner
              match={activeMatch}
              liveScore={liveScore}
              onResume={() => navigate(`/match/${activeMatch.id}/scoring`)}
            />
          )}

          {/* New Match CTA */}
          <div className="px-4">
            <Button
              variant={activeMatch ? 'secondary' : 'gold'}
              size={activeMatch ? 'lg' : 'xl'}
              fullWidth
              onClick={() => navigate('/new-match')}
            >
              <PlusCircle size={activeMatch ? 18 : 22} className="mr-2 shrink-0" />
              New Match
            </Button>
          </div>

          {/* Last completed match */}
          {lastCompleted && (
            <LastMatchCard
              match={lastCompleted}
              scores={matchScores[lastCompleted.id] ?? {}}
              onScorecard={() => navigate(`/match/${lastCompleted.id}/scorecard`)}
              onShare={handleShareLast}
              onRematch={() => handleRematch(lastCompleted)}
            />
          )}

          {/* Recent matches */}
          {recentCompleted.length > 1 && (
            <div className="px-4">
              <div className="flex items-center justify-between mb-2 px-0.5">
                <p className="text-muted text-[11px] font-black uppercase tracking-widest">Recent</p>
                <button
                  onClick={() => navigate('/history')}
                  className="text-gold text-xs font-semibold hover:text-gold-light transition-colors"
                >
                  View All →
                </button>
              </div>
              <div className="space-y-2">
                {recentCompleted.slice(1).map((m) => (
                  <RecentMatchRow
                    key={m.id}
                    match={m}
                    scores={matchScores[m.id]}
                    onClick={() => navigate(`/match/${m.id}/scorecard`)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
