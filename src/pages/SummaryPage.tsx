import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Share2, ClipboardList, Home, RefreshCw, CheckCircle2, Zap, Target } from 'lucide-react';
import { TopBar } from '@/components/layout/TopBar';
import { Button } from '@/components/common/Button';
import { Spinner } from '@/components/common/Spinner';
import { Confetti } from '@/components/common/Confetti';
import { getMatch } from '@/db/repos/matchRepo';
import { getMatchInnings } from '@/db/repos/inningsRepo';
import { getInningsDeliveries } from '@/db/repos/playerRepo';
import { computeInningsStats, computeRunRate } from '@/utils/cricket';
import { formatDate, formatScore, formatOversShort } from '@/utils/format';
import { buildShareText } from '@/utils/share';
import { buildShareImage, shareImageOrFallback } from '@/utils/shareImage';
import { useUIStore } from '@/store/uiStore';
import { useMatch } from '@/hooks/useMatch';
import type { Match, Innings } from '@/types/match.types';
import type { InningsStats } from '@/types/delivery.types';
import { cn } from '@/utils/cn';

export default function SummaryPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { upsertMatch } = useMatch();
  const { addToast } = useUIStore();
  const [loading, setLoading] = useState(true);
  const [match, setMatch] = useState<Match | null>(null);
  const [innings1, setInnings1] = useState<{ innings: Innings; stats: InningsStats } | null>(null);
  const [innings2, setInnings2] = useState<{ innings: Innings; stats: InningsStats } | null>(null);
  const [motmId, setMotmId] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [playerSnaps, setPlayerSnaps] = useState<Record<string, { runs: number; wickets: number }>>({});
  // stagger reveal state: hero → sections appear after brief delay
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    (async () => {
      if (!matchId) return;
      const m = await getMatch(matchId);
      if (!m) { navigate('/'); return; }
      setMatch(m);
      const allPlayers = [...m.teams[0].players, ...m.teams[1].players];
      const resolveName = (id: string) => allPlayers.find((p) => p.id === id)?.name ?? id;
      const allInnings = await getMatchInnings(matchId);
      let topScorerId = '';
      let topRuns = -1;
      const snaps: Record<string, { runs: number; wickets: number }> = {};
      for (const i of allInnings) {
        const deliveries = await getInningsDeliveries(i.id);
        const s = computeInningsStats(deliveries, resolveName);
        if (i.inningsNumber === 1) setInnings1({ innings: i, stats: s });
        else setInnings2({ innings: i, stats: s });
        for (const [pid, bs] of Object.entries(s.batsmanScores)) {
          snaps[pid] = { runs: (snaps[pid]?.runs ?? 0) + bs.runs, wickets: snaps[pid]?.wickets ?? 0 };
          if (bs.runs > topRuns) { topRuns = bs.runs; topScorerId = pid; }
        }
        for (const [pid, bwl] of Object.entries(s.bowlerScores)) {
          snaps[pid] = { runs: snaps[pid]?.runs ?? 0, wickets: (snaps[pid]?.wickets ?? 0) + bwl.wickets };
        }
      }
      setPlayerSnaps(snaps);
      setMotmId(m.result?.manOfTheMatchId || topScorerId);
      setLoading(false);
      if (m.result?.winnerId) {
        setShowConfetti(true);
        // stagger: let hero render first, then fade-up the lower sections
        setTimeout(() => setRevealed(true), 400);
      } else {
        setRevealed(true);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  const handleShare = async () => {
    if (!match || !innings1) return;
    const blob = await buildShareImage(
      match,
      innings1.innings, innings1.stats,
      innings2?.innings ?? null, innings2?.stats ?? null,
    );
    if (blob) {
      const fallback = buildShareText(match, innings1.innings, innings1.stats, innings2?.innings ?? null, innings2?.stats ?? null);
      const result = await shareImageOrFallback(blob, fallback);
      if (result === 'copied') addToast('Scorecard copied!', 'success');
      if (result === 'failed') addToast('Could not share scorecard', 'error');
    } else {
      addToast('Could not generate scorecard image', 'error');
    }
  };

  const handleMotmSave = async (id: string) => {
    if (!match) return;
    const updated: Match = { ...match, result: { ...match.result!, manOfTheMatchId: id } };
    await upsertMatch(updated);
    setMatch(updated);
    setMotmId(id);
    addToast('Man of the Match saved!', 'success');
  };

  if (loading) return <div className="min-h-screen bg-pitch flex items-center justify-center"><Spinner /></div>;
  if (!match) return null;

  const allPlayers = [...match.teams[0].players, ...match.teams[1].players];
  const winnerId   = match.result?.winnerId ?? null;
  const winnerTeam = winnerId ? match.teams.find((t) => t.id === winnerId) : null;
  const loserTeam  = winnerId ? match.teams.find((t) => t.id !== winnerId) : null;
  const isTie = !winnerId && match.status === 'completed';

  // Aggregate match stats
  const totalRuns    = (innings1?.stats.totalRuns    ?? 0) + (innings2?.stats.totalRuns    ?? 0);
  const totalWickets = (innings1?.stats.wickets      ?? 0) + (innings2?.stats.wickets      ?? 0);
  const totalSixes   = Object.values({ ...innings1?.stats.batsmanScores, ...innings2?.stats.batsmanScores })
    .reduce((s, b) => s + (b.sixes ?? 0), 0);
  const totalFours   = Object.values({ ...innings1?.stats.batsmanScores, ...innings2?.stats.batsmanScores })
    .reduce((s, b) => s + (b.fours ?? 0), 0);

  // Top MoTM candidates
  const topCandidates = allPlayers
    .filter((p) => { const s = playerSnaps[p.id]; return s && (s.runs >= 10 || s.wickets >= 1); })
    .sort((a, b) => {
      const sa = playerSnaps[a.id];
      const sb = playerSnaps[b.id];
      return ((sb?.runs ?? 0) + (sb?.wickets ?? 0) * 20) - ((sa?.runs ?? 0) + (sa?.wickets ?? 0) * 20);
    })
    .slice(0, 3)
    .map((p) => p.id);

  const motmPlayer = motmId ? allPlayers.find((p) => p.id === motmId) : null;
  const motmSnap   = motmId ? playerSnaps[motmId] : null;

  return (
    <div className="min-h-screen bg-pitch flex flex-col">
      <Confetti active={showConfetti} duration={5500} />
      <TopBar title="Match Result" subtitle={match.name} showBack onBack={() => navigate('/')} />

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 pt-4 pb-8 space-y-4">

          {/* ── RESULT HERO ─────────────────────────────────────────────────── */}
          {winnerTeam ? (
            <div className={cn(
              'relative overflow-hidden rounded-3xl border border-gold/30',
              'bg-gradient-to-b from-[rgb(var(--color-gold)/0.18)] via-[rgb(var(--color-gold)/0.07)] to-transparent',
              'animate-pulse-gold',
            )}>
              {/* Gold top bar */}
              <div className="h-[3px] bg-gradient-to-r from-transparent via-gold to-transparent" />

              {/* Subtle radial glow behind trophy */}
              <div
                className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full pointer-events-none"
                style={{ background: 'radial-gradient(ellipse at 50% 0%, rgb(var(--color-gold)/0.22) 0%, transparent 70%)' }}
              />

              <div className="relative px-5 pt-6 pb-7 text-center">
                {/* Trophy — spring drop animation */}
                <div className="text-7xl leading-none mb-4 animate-trophy-drop inline-block">🏆</div>

                {/* CHAMPIONS badge */}
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-gold/15 border border-gold/40 mb-3 animate-fade-in">
                  <span className="text-gold text-[10px] font-black uppercase tracking-[3px]">Champions</span>
                </div>

                {/* Winner name — shimmer gold display font */}
                <p className="shimmer-gold font-display text-5xl leading-tight tracking-wide mb-1 animate-pop-in">
                  {winnerTeam.name}
                </p>

                {/* Result text */}
                <p className="text-white/80 font-bold text-base leading-snug mt-1">
                  {match.result?.resultText}
                </p>

                {/* VS row */}
                {loserTeam && (
                  <p className="text-muted text-xs mt-2">
                    def. <span className="text-white/60 font-semibold">{loserTeam.name}</span>
                  </p>
                )}

                <p className="text-muted/60 text-[11px] mt-3">{formatDate(match.createdAt)}</p>
              </div>

              {/* Gold bottom bar */}
              <div className="h-[2px] bg-gradient-to-r from-transparent via-gold/50 to-transparent" />
            </div>
          ) : isTie ? (
            <div className="relative overflow-hidden rounded-3xl border border-safe/30 bg-gradient-to-b from-safe/15 via-safe/6 to-transparent text-center px-5 pt-6 pb-6">
              <div className="h-[3px] bg-gradient-to-r from-transparent via-safe to-transparent absolute top-0 inset-x-0" />
              <div className="text-6xl mb-3 leading-none animate-trophy-drop inline-block">🤝</div>
              <p className="font-display text-4xl text-safe leading-none mb-1">It's a Tie!</p>
              <p className="text-white/60 text-sm mt-1">{match.result?.resultText ?? 'Match Tied'}</p>
              <p className="text-muted/60 text-[11px] mt-2">{formatDate(match.createdAt)}</p>
            </div>
          ) : (
            <div className="bg-pitch-light rounded-3xl border border-pitch-light px-5 py-5 text-center">
              <div className="text-5xl mb-3 leading-none">🏏</div>
              <p className="font-black text-white text-lg">{match.result?.resultText ?? 'Match Complete'}</p>
              <p className="text-muted text-xs mt-1">{formatDate(match.createdAt)}</p>
            </div>
          )}

          {/* Everything below fades up after the hero */}
          <div className={cn(
            'space-y-4 transition-all duration-500',
            revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4',
          )}>

            {/* ── INNINGS CARDS ───────────────────────────────────────────────── */}
            <div className="space-y-2">
              {innings1 && (
                <InningsSummaryCard match={match} item={innings1} label="1st Innings" winnerId={winnerId} />
              )}
              {innings2 && (
                <InningsSummaryCard match={match} item={innings2} label="2nd Innings" winnerId={winnerId} />
              )}
            </div>

            {/* ── MATCH STATS STRIP ──────────────────────────────────────────── */}
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Runs',    value: totalRuns,    icon: <Zap size={12} />,                                       color: 'text-runs'   },
                { label: 'Wickets', value: totalWickets, icon: <Target size={12} />,                                    color: 'text-wicket' },
                { label: 'Sixes',   value: totalSixes,   icon: <span className="text-[10px] font-black leading-none">6s</span>, color: 'text-six'    },
                { label: 'Fours',   value: totalFours,   icon: <span className="text-[10px] font-black leading-none">4s</span>, color: 'text-four'   },
              ].map(({ label, value, icon, color }) => (
                <div key={label} className="bg-pitch-light rounded-2xl p-3 text-center flex flex-col items-center gap-0.5">
                  <div className={cn('mb-0.5', color)}>{icon}</div>
                  <p className={cn('font-black text-2xl leading-none', color)}>{value}</p>
                  <p className="text-muted text-[9px] font-semibold uppercase tracking-wide leading-tight">{label}</p>
                </div>
              ))}
            </div>

            {/* ── MAN OF THE MATCH ────────────────────────────────────────────── */}
            <div className="bg-pitch-light rounded-2xl overflow-hidden">
              {/* Gold top accent */}
              <div className="h-[2px] bg-gradient-to-r from-transparent via-gold/60 to-transparent" />

              <div className="p-4">
                <p className="text-[10px] text-muted font-black uppercase tracking-[3px] mb-3">
                  Man of the Match
                </p>

                {/* Selected MoTM award display */}
                {motmPlayer && (
                  <div className="flex items-center gap-3 bg-gold/10 border border-gold/30 rounded-2xl px-4 py-3 mb-3">
                    {/* Medal */}
                    <div className="shrink-0 w-10 h-10 rounded-full bg-gold/20 border-2 border-gold/50 flex items-center justify-center text-xl leading-none animate-pop-in">
                      🥇
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-black text-gold text-base leading-tight truncate">{motmPlayer.name}</p>
                      <p className="text-muted text-[11px] mt-0.5">
                        {match.teams.find((t) => t.id === motmPlayer.teamId)?.name}
                      </p>
                      {motmSnap && (motmSnap.runs > 0 || motmSnap.wickets > 0) && (
                        <p className="text-[11px] mt-0.5">
                          {motmSnap.runs > 0 && <span className="text-runs font-bold">{motmSnap.runs} runs</span>}
                          {motmSnap.runs > 0 && motmSnap.wickets > 0 && <span className="text-muted/50 mx-1">·</span>}
                          {motmSnap.wickets > 0 && <span className="text-wicket font-bold">{motmSnap.wickets} wkt{motmSnap.wickets !== 1 ? 's' : ''}</span>}
                        </p>
                      )}
                    </div>
                    <CheckCircle2 size={18} className="text-gold shrink-0" />
                  </div>
                )}

                {/* Candidate list */}
                {topCandidates.length > 0 && (
                  <div className="space-y-1.5 mb-2">
                    {topCandidates.map((id) => {
                      const p = allPlayers.find((pl) => pl.id === id);
                      if (!p) return null;
                      const isSelected = motmId === id;
                      const snap = playerSnaps[id];
                      const teamName = match.teams.find((t) => t.id === p.teamId)?.name;
                      return (
                        <button
                          key={id}
                          onClick={() => handleMotmSave(id)}
                          className={cn(
                            'w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-left transition-all active:scale-[0.98]',
                            isSelected
                              ? 'bg-gold/15 border-gold/50'
                              : 'bg-pitch-dark border-pitch-light hover:border-gold/30',
                          )}
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className={cn('font-bold text-sm', isSelected ? 'text-gold' : 'text-white')}>
                                {p.name}
                              </span>
                              {teamName && <span className="text-[11px] text-muted">{teamName}</span>}
                            </div>
                            {snap && (snap.runs > 0 || snap.wickets > 0) && (
                              <p className="text-[11px] text-muted mt-0.5">
                                {snap.runs > 0 && <span className="text-runs">{snap.runs} runs</span>}
                                {snap.runs > 0 && snap.wickets > 0 && <span className="mx-1 opacity-30">·</span>}
                                {snap.wickets > 0 && <span className="text-wicket">{snap.wickets} wkt{snap.wickets !== 1 ? 's' : ''}</span>}
                              </p>
                            )}
                          </div>
                          {isSelected
                            ? <CheckCircle2 size={15} className="text-gold shrink-0" />
                            : <span className="text-[10px] text-muted/40 shrink-0">tap</span>
                          }
                        </button>
                      );
                    })}
                  </div>
                )}

                {/* Full list accordion */}
                <details className="group">
                  <summary className="text-xs text-muted/50 cursor-pointer select-none py-1 flex items-center gap-1 hover:text-muted/80 list-none">
                    <span className="group-open:hidden">▸ All players</span>
                    <span className="hidden group-open:inline">▾ All players</span>
                  </summary>
                  <div className="space-y-1 mt-2 max-h-48 overflow-y-auto pr-0.5">
                    {allPlayers.map((p) => {
                      const isSelected = motmId === p.id;
                      const teamName = match.teams.find((t) => t.id === p.teamId)?.name;
                      const snap = playerSnaps[p.id];
                      return (
                        <button
                          key={p.id}
                          onClick={() => handleMotmSave(p.id)}
                          className={cn(
                            'w-full flex items-center justify-between px-4 py-2 rounded-xl border text-left transition-all active:scale-[0.98]',
                            isSelected ? 'bg-gold/15 border-gold/50' : 'bg-pitch-dark border-pitch-light hover:border-white/20',
                          )}
                        >
                          <div className="min-w-0">
                            <span className={cn('font-semibold text-sm', isSelected ? 'text-gold' : 'text-white')}>
                              {p.name}
                            </span>
                            {teamName && <span className="text-xs text-muted ml-2">{teamName}</span>}
                            {snap && (snap.runs > 0 || snap.wickets > 0) && (
                              <p className="text-[11px] text-muted mt-0.5">
                                {snap.runs > 0 && <span>{snap.runs} runs</span>}
                                {snap.runs > 0 && snap.wickets > 0 && <span className="mx-1 opacity-30">·</span>}
                                {snap.wickets > 0 && <span>{snap.wickets} wkt{snap.wickets !== 1 ? 's' : ''}</span>}
                              </p>
                            )}
                          </div>
                          {isSelected && <CheckCircle2 size={14} className="text-gold shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </details>
              </div>
            </div>

            {/* ── ACTIONS ─────────────────────────────────────────────────────── */}
            <div className="space-y-2 pb-2">
              <Button
                variant="gold"
                size="lg"
                fullWidth
                onClick={() => navigate('/new-match', { state: { rematch: { teams: match.teams } } })}
              >
                <RefreshCw size={18} className="mr-2" /> Rematch
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" size="md" fullWidth onClick={handleShare}>
                  <Share2 size={16} className="mr-1.5" /> Share
                </Button>
                <Button variant="secondary" size="md" fullWidth onClick={() => navigate(`/match/${matchId}/scorecard`)}>
                  <ClipboardList size={16} className="mr-1.5" /> Scorecard
                </Button>
              </div>
              <Button variant="ghost" size="lg" fullWidth onClick={() => navigate('/')}>
                <Home size={18} className="mr-2" /> Back to Home
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InningsSummaryCard({
  match,
  item,
  label,
  winnerId,
}: {
  match: Match;
  item: { innings: Innings; stats: InningsStats };
  label: string;
  winnerId: string | null;
}) {
  const battingTeam = match.teams.find((t) => t.id === item.innings.battingTeamId);
  const bowlingTeam = match.teams.find((t) => t.id === item.innings.bowlingTeamId);
  const allPlayers  = [...match.teams[0].players, ...match.teams[1].players];
  const resolveName = (id: string) => allPlayers.find((p) => p.id === id)?.name ?? id;
  const isWinner    = !!winnerId && item.innings.battingTeamId === winnerId;

  const batters   = Object.values(item.stats.batsmanScores);
  const topBatter = batters.reduce<typeof batters[0] | null>((best, b) => (!best || b.runs > best.runs ? b : best), null);
  const bowlers   = Object.values(item.stats.bowlerScores).filter((b) => b.legalBalls > 0);
  const topBowler = bowlers.reduce<typeof bowlers[0] | null>((best, b) => {
    if (!best) return b;
    if (b.wickets !== best.wickets) return b.wickets > best.wickets ? b : best;
    return b.runs < best.runs ? b : best;
  }, null);

  const rr = computeRunRate(item.stats.totalRuns, item.stats.legalBalls);

  return (
    <div className={cn(
      'rounded-2xl overflow-hidden',
      isWinner
        ? 'bg-pitch-light border border-gold/25'
        : 'bg-pitch-light border border-pitch-light/40 opacity-75',
    )}>
      {isWinner && <div className="h-[2px] bg-gradient-to-r from-gold/30 via-gold to-gold/30" />}

      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-1.5 mb-0.5">
              <p className="text-muted text-[10px] font-semibold uppercase tracking-wide">{label}</p>
              {isWinner && (
                <span className="text-[9px] font-black text-gold bg-gold/15 border border-gold/30 rounded-full px-1.5 py-0.5 leading-none">
                  ★ WON
                </span>
              )}
            </div>
            <p className={cn('font-black text-base leading-tight', isWinner ? 'text-white' : 'text-white/80')}>
              {battingTeam?.name}
            </p>
            <p className="text-muted text-xs">vs {bowlingTeam?.name}</p>
          </div>
          <div className="text-right">
            <p className={cn('text-3xl font-black leading-none', isWinner ? 'text-gold' : 'text-white')}>
              {formatScore(item.stats.totalRuns, item.stats.wickets)}
            </p>
            <p className="text-muted text-[11px] font-mono mt-0.5">
              {formatOversShort(item.stats.legalBalls)} ov · RR {rr.toFixed(2)}
            </p>
          </div>
        </div>

        {(topBatter || topBowler) && (
          <div className="flex gap-3 pt-2.5 border-t border-pitch/50">
            {topBatter && topBatter.runs > 0 && (
              <div className="flex-1 min-w-0">
                <p className="text-[9px] text-muted/60 font-black uppercase tracking-widest mb-0.5">Top Bat</p>
                <p className="text-white text-xs font-bold truncate">{resolveName(topBatter.playerId)}</p>
                <p className="text-runs text-[11px] font-bold">
                  {topBatter.runs}<span className="font-normal text-muted"> runs</span>
                  <span className="text-muted/50 mx-1">·</span>
                  <span className="text-muted">SR </span>{topBatter.strikeRate.toFixed(0)}
                </p>
              </div>
            )}
            {topBowler && topBowler.wickets > 0 && (
              <div className="flex-1 min-w-0">
                <p className="text-[9px] text-muted/60 font-black uppercase tracking-widest mb-0.5">Top Bowl</p>
                <p className="text-white text-xs font-bold truncate">{resolveName(topBowler.playerId)}</p>
                <p className="text-wicket text-[11px] font-bold">
                  {topBowler.wickets}W<span className="text-muted font-normal"> · {topBowler.runs}R</span>
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
