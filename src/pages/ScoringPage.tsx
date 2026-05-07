import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ClipboardList, MoreVertical } from 'lucide-react';
import { useTheme } from '@/hooks/useTheme';
import { Scoreboard } from '@/components/scoring/Scoreboard';
import { BatsmanPanel } from '@/components/scoring/BatsmanPanel';
import { BowlerPanel } from '@/components/scoring/BowlerPanel';
import { OverTracker } from '@/components/scoring/OverTracker';
import { BallButtons } from '@/components/scoring/BallButtons';
import { WicketModal } from '@/components/scoring/WicketModal';
import { ExtrasModal } from '@/components/scoring/ExtrasModal';
import { NewOverModal } from '@/components/scoring/NewOverModal';
import { InningsBreakModal } from '@/components/scoring/InningsBreakModal';
import { UndoBar } from '@/components/scoring/UndoBar';
import { BattingOrderPanel } from '@/components/scoring/BattingOrderPanel';
import { ChangeBatsmanModal } from '@/components/scoring/ChangeBatsmanModal';
import { ChangeBowlerModal } from '@/components/scoring/ChangeBowlerModal';
import { CloseInningsModal } from '@/components/scoring/CloseInningsModal';
import { CloseMatchModal } from '@/components/scoring/CloseMatchModal';
import { EventFlash } from '@/components/scoring/EventFlash';
import { Spinner } from '@/components/common/Spinner';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { useScoring } from '@/hooks/useScoring';
import { useScoringStore } from '@/store/scoringStore';
import { useMatch } from '@/hooks/useMatch';
import { useUIStore } from '@/store/uiStore';
import { getMatch } from '@/db/repos/matchRepo';
import { getMatchInnings, saveInnings } from '@/db/repos/inningsRepo';
import { getInningsDeliveries } from '@/db/repos/playerRepo';
import type { Innings, Match } from '@/types/match.types';
import type { DeliveryExtras, Wicket } from '@/types/delivery.types';
import { computeInningsStats, buildResultText } from '@/utils/cricket';
import { formatScore } from '@/utils/format';
import { canContinueWithLoneBatter, getRemainingBatsmenCount } from '@/utils/inningsFlow';
import { v4 as uuid } from 'uuid';

type ExtrasType = 'wide' | 'no_ball' | 'bye' | 'leg_bye' | null;

export default function ScoringPage() {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const { score, undo, loadInnings, finaliseInnings, rotateStrike, changeBatsman, changeBowler, retireHurt, recallRetiredBatsman, toggleFreeHit, innings, match, stats, deliveries, lastDelivery, clear, selectNextBatsman } = useScoring();
  const { upsertMatch } = useMatch();
  const { addToast } = useUIStore();

  const [loading, setLoading] = useState(true);
  const [showWicket, setShowWicket] = useState(false);
  const [extrasType, setExtrasType] = useState<ExtrasType>(null);
  const [showNewOver, setShowNewOver] = useState(false);
  const [showInningsBreak, setShowInningsBreak] = useState(false);
  const [inn1Stats, setInn1Stats] = useState(stats);
  const [completedOverRuns, setCompletedOverRuns] = useState(0);
  const [completedOverWickets, setCompletedOverWickets] = useState(0);
  const [showPauseConfirm, setShowPauseConfirm] = useState(false);
  const [changeBatsmanPosition, setChangeBatsmanPosition] = useState<0 | 1 | null>(null);
  const [changeBatsmanContext, setChangeBatsmanContext] = useState<'post_wicket' | 'voluntary'>('voluntary');
  const [showChangeBowler, setShowChangeBowler] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showCloseInnings, setShowCloseInnings] = useState(false);
  const [showCloseMatch, setShowCloseMatch] = useState(false);
  const [showInningsSettings, setShowInningsSettings] = useState(false);
  const [settingsOvers, setSettingsOvers] = useState('');
  const [settingsLastManStands, setSettingsLastManStands] = useState(false);
  const [pendingInningsBreak, setPendingInningsBreak] = useState<{ match: Match; completedInnings: Innings } | null>(null);
  const { isDark, toggle: toggleTheme } = useTheme();

  useEffect(() => {
    if (!match) return;
    setSettingsOvers(String(match.config.overs));
    setSettingsLastManStands(match.rules.lastManStands);
  }, [match]);

  useEffect(() => {
    (async () => {
      if (!matchId) return;
      const m = await getMatch(matchId);
      if (!m) { navigate('/'); return; }
      const allInnings = await getMatchInnings(matchId);
      const activeInnings = allInnings.find((i) => i.status === 'active');
      if (!activeInnings) {
        const inn1 = allInnings.find((i) => i.inningsNumber === 1);
        const inn2 = allInnings.find((i) => i.inningsNumber === 2);
        if (m.status !== 'completed' && inn1?.status === 'completed' && !inn2) {
          const d = await getInningsDeliveries(inn1.id);
          setInn1Stats(computeInningsStats(d));
          setPendingInningsBreak({ match: m, completedInnings: inn1 });
          setShowInningsBreak(true);
          setLoading(false);
          return;
        }
        navigate(`/match/${matchId}/summary`);
        return;
      }
      // If 2nd innings, load inn1Stats
      if (activeInnings.inningsNumber === 2) {
        const inn1 = allInnings.find((i) => i.inningsNumber === 1);
        if (inn1) {
          const d = await getInningsDeliveries(inn1.id);
          setInn1Stats(computeInningsStats(d));
        }
      }
      await loadInnings(m, activeInnings);
      setLoading(false);
    })();
    return () => clear();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId]);

  // Need bowler selection on load if currentBowlerId is null
  const needsBowlerSelection = innings && !innings.currentBowlerId;

  // Need batsman selection if a slot is empty and innings is still active.
  // Exception: Last Man Stands allows continuing with a lone batter when no
  // unused batter remains.
  const needsBatsmanSelection = (() => {
    if (!innings || innings.status !== 'active') return false;
    const hasEmptySlot = innings.currentBatsmanIds.some((id) => id === '' || id == null);
    if (!hasEmptySlot) return false;
    if (!match) return true;
    return !canContinueWithLoneBatter(match, innings);
  })();

  // Ball buttons should be disabled when either selection is pending
  const ballsDisabled = (needsBowlerSelection || needsBatsmanSelection) ?? undefined;

  // Auto-open bowler modal on first load when no opening bowler chosen yet
  useEffect(() => {
    if (!loading && needsBowlerSelection) setShowNewOver(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  const handleRun = async (runs: number) => {
    if (!innings || !match) return;
    const result = await score({ runs, extras: { wide: 0, noBall: 0, bye: 0, legBye: 0 } });
    await handlePostDelivery(result);
  };

  // Bug 6 fix: close NewOverModal on undo so it doesn't stay stuck open
  const handleUndo = async () => {
    setShowNewOver(false);
    await undo();
  };

  const handleExtrasConfirm = async (extras: DeliveryExtras, batsmanRuns: number) => {
    setExtrasType(null);
    const result = await score({ runs: batsmanRuns, extras });
    await handlePostDelivery(result);
  };

  const handleWicketConfirm = async (wicket: Wicket, nextBatsmanId: string | null, runs: number, extras: DeliveryExtras) => {
    setShowWicket(false);
    if (!innings || !match) return;

    // Score the wicket FIRST — store clears the dismissed batsman's slot.
    const result = await score({ runs, extras, wicket });

    if (!result.isInningsOver) {
      if (nextBatsmanId) {
        // Batsman was pre-selected in the modal — fill the slot immediately.
        const currentInnings = useScoringStore.getState().innings!;
        const updatedInnings = selectNextBatsman(currentInnings, nextBatsmanId);
        await saveInnings(updatedInnings);
        await loadInnings(match!, updatedInnings);
      } else {
        const freshInnings = useScoringStore.getState().innings!;

        // Last-man-stands: if no unused batter remains, allow the surviving
        // batter to continue alone by occupying both crease slots.
        if (match.rules.lastManStands && getRemainingBatsmenCount(match, freshInnings) === 0) {
          const survivorId = (freshInnings.currentBatsmanIds.find((id) => !!id && id !== '') ?? '') as string;
          if (survivorId) {
            const loneBatterInnings: Innings = {
              ...freshInnings,
              currentBatsmanIds: [survivorId, ''],
              strikerIndex: 0,
            };
            await saveInnings(loneBatterInnings);
            await loadInnings(match, loneBatterInnings);
          }
          await handlePostDelivery(result);
          return;
        }

        // No batsman selected (or none available yet) — force manual selection.
        const emptySlot = freshInnings.currentBatsmanIds[0] === '' || freshInnings.currentBatsmanIds[0] == null
          ? 0
          : 1;
        setChangeBatsmanContext('post_wicket');
        setChangeBatsmanPosition(emptySlot as 0 | 1);
      }
    }

    await handlePostDelivery(result);
  };

  const handlePostDelivery = async (result: Awaited<ReturnType<typeof score>>) => {
    if (!match || !innings) return;

    // Bug 3 fix: target reached mid-over in 2nd innings — end the match immediately
    // before checking isInningsOver (which only fires at all-out or last ball).
    if (innings.inningsNumber === 2 && inn1Stats && result.newStats.totalRuns > inn1Stats.totalRuns) {
      await finaliseInnings('target_achieved');
      await completeMatch(result.newStats);
      return;
    }

    if (result.isInningsOver) {
      await finaliseInnings(result.newStats.wickets >= (match.rules.lastManStands ? match.config.playersPerSide : match.config.playersPerSide - 1) ? 'all_out' : 'overs_complete');

      if (innings.inningsNumber === 1) {
        setInn1Stats(result.newStats);
        setShowInningsBreak(true);
      } else {
        await completeMatch(result.newStats);
      }
      return;
    }

    if (result.isOverComplete) {
      // Bug 5 fix: use overSummaries from newStats — avoids stale React deliveries state
      const overSummary = result.newStats.overSummaries.find((ov) => ov.overIndex === result.delivery.overIndex);
      setCompletedOverRuns(overSummary?.runs ?? 0);
      setCompletedOverWickets(overSummary?.wickets ?? 0);
      setShowNewOver(true);
    }
  };

  const handleNewOverBowler = async (bowlerId: string) => {
    if (!innings) return;
    const updated = { ...innings, currentBowlerId: bowlerId };
    await saveInnings(updated);
    await loadInnings(match!, updated);
    setShowNewOver(false);
  };

  const handleChangeBatsman = async (playerId: string) => {
    if (changeBatsmanPosition === null) return;
    await changeBatsman(changeBatsmanPosition, playerId);
    setChangeBatsmanPosition(null);
    const name = match?.teams.flatMap((t) => t.players).find((p) => p.id === playerId)?.name;
    if (name) addToast(`${name} is in`, 'success');
  };


  const handleAddBowlerToTeam = async (name: string) => {
    if (!match || !innings) return;
    const teamIndex = match.teams.findIndex((t) => t.id === innings.bowlingTeamId);
    if (teamIndex < 0) return;
    const exists = match.teams[teamIndex].players.some((p) => p.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      addToast(`${name} already in bowling team`, 'info');
      return;
    }
    const [teamA, teamB] = match.teams;
    const updatedTeams: Match['teams'] = teamIndex === 0
      ? [{ ...teamA, players: [...teamA.players, { id: uuid(), name, teamId: innings.bowlingTeamId }] }, teamB]
      : [teamA, { ...teamB, players: [...teamB.players, { id: uuid(), name, teamId: innings.bowlingTeamId }] }];

    const updatedMatch: Match = {
      ...match,
      teams: updatedTeams,
    };
    await upsertMatch(updatedMatch);
    await loadInnings(updatedMatch, innings);
    addToast(`${name} added to bowling team`, 'success');
  };

  const handleChangeBowler = async (bowlerId: string) => {
    await changeBowler(bowlerId);
    setShowChangeBowler(false);
    const name = match?.teams.flatMap((t) => t.players).find((p) => p.id === bowlerId)?.name;
    if (name) addToast(`${name} to bowl`, 'info');
  };

  const handleRetireHurt = async (batsmanId: string, nextBatsmanId: string | null) => {
    await retireHurt(batsmanId, nextBatsmanId);
  };

  const handleRecallRetired = async (playerId: string) => {
    if (changeBatsmanPosition === null) return;
    await recallRetiredBatsman(playerId, changeBatsmanPosition);
    setChangeBatsmanPosition(null);
  };

  const handleCloseInnings = async (reason: 'declared' | 'abandoned') => {
    if (!match || !innings || !stats) return;
    setShowCloseInnings(false);
    addToast(reason === 'abandoned' ? 'Innings abandoned' : 'Innings declared', 'info');

    if (reason === 'abandoned') {
      // Abandon: mark innings completed, then end match with no result
      await finaliseInnings('abandoned');
      const updatedMatch: Match = {
        ...match,
        status: 'completed',
        result: { winnerId: null, margin: 0, marginType: 'tie', resultText: 'Match Abandoned' },
      };
      await upsertMatch(updatedMatch);
      navigate(`/match/${match.id}/summary`);
      return;
    }

    // Declared
    await finaliseInnings('declared');
    if (innings.inningsNumber === 1) {
      setInn1Stats(stats);
      setShowInningsBreak(true);
    } else {
      await completeMatch(stats);
    }
  };

  const handleCloseMatch = async (winnerId: string | null) => {
    if (!match) return;
    setShowCloseMatch(false);

    const winningTeam = match.teams.find((t) => t.id === winnerId);
    const resultText = winnerId ? `${winningTeam?.name ?? 'Team'} won` : 'Match Abandoned';
    const updatedMatch: Match = {
      ...match,
      status: 'completed',
      result: { winnerId, margin: 0, marginType: winnerId ? 'runs' : 'tie', resultText },
    };
    await upsertMatch(updatedMatch);
    navigate(`/match/${match.id}/summary`);
  };

  const handleInningsBreakStart = async ({ striker, nonStriker, bowler }: { striker: string; nonStriker: string; bowler: string }) => {
    const baseMatch = match ?? pendingInningsBreak?.match;
    if (!baseMatch) return;
    const allInnings = await getMatchInnings(baseMatch.id);
    const inn1 = allInnings.find((i) => i.inningsNumber === 1);
    const battingTeamId = inn1!.bowlingTeamId;
    const bowlingTeamId = inn1!.battingTeamId;

    const newInnings: Innings = {
      id: uuid(),
      matchId: baseMatch.id,
      inningsNumber: 2,
      battingTeamId,
      bowlingTeamId,
      status: 'active',
      currentBatsmanIds: [striker, nonStriker],
      strikerIndex: 0,
      currentBowlerId: bowler,
      battingOrder: [striker, nonStriker],
    };

    const updatedMatch: Match = { ...baseMatch, status: 'innings_2', inningsIds: [...baseMatch.inningsIds, newInnings.id] };
    await saveInnings(newInnings);
    await upsertMatch(updatedMatch);
    await loadInnings(updatedMatch, newInnings);
    setShowInningsBreak(false);
    setPendingInningsBreak(null);
  };

  const completeMatch = async (inn2Stats: typeof stats) => {
    if (!match || !inn1Stats || !inn2Stats) return;
    const inn2Runs = inn2Stats.totalRuns;
    const inn1Runs = inn1Stats.totalRuns;
    const allInnings = await getMatchInnings(match.id);
    const inn2 = allInnings.find((i) => i.inningsNumber === 2);
    const chasingTeamName = match.teams.find((t) => t.id === inn2?.battingTeamId)?.name ?? '';
    const defendingTeamName = match.teams.find((t) => t.id === inn2?.bowlingTeamId)?.name ?? '';

    let winnerId: string | null = null;
    let margin = 0;
    let marginType: 'runs' | 'wickets' | 'tie' = 'tie';
    let resultText = '';

    if (inn2Runs > inn1Runs) {
      winnerId = inn2?.battingTeamId ?? null;
      margin = match.config.playersPerSide - inn2Stats.wickets;
      marginType = 'wickets';
      resultText = buildResultText(chasingTeamName, margin, 'wickets');
    } else if (inn2Runs < inn1Runs) {
      winnerId = inn2?.bowlingTeamId ?? null;
      margin = inn1Runs - inn2Runs;
      marginType = 'runs';
      resultText = buildResultText(defendingTeamName, margin, 'runs');
    } else {
      resultText = 'Match Tied';
    }

    const updatedMatch: Match = {
      ...match,
      status: 'completed',
      result: { winnerId, margin, marginType, resultText },
    };
    await upsertMatch(updatedMatch);
    navigate(`/match/${match.id}/summary`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-pitch flex items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!match || !innings || !stats) {
    if (pendingInningsBreak && inn1Stats) {
      return (
        <div className="min-h-screen bg-pitch">
          <InningsBreakModal
            isOpen={showInningsBreak}
            match={pendingInningsBreak.match}
            completedInnings={pendingInningsBreak.completedInnings}
            inn1Stats={inn1Stats}
            onStart={handleInningsBreakStart}
          />
        </div>
      );
    }
    return null;
  }

  return (
    <div className="h-screen bg-pitch flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="shrink-0 sticky top-0 z-30 flex items-center justify-between px-4 py-2 glass border-b border-white/[0.06] shadow-[0_1px_0_0_rgb(255_255_255/0.04),0_2px_8px_0_rgb(0_0_0/0.3)] min-h-[48px]">
        <div className="flex items-center gap-2 min-w-0">
          {/* Live indicator dot */}
          <span className="shrink-0 w-2 h-2 rounded-full bg-safe animate-pulse" aria-hidden />
          <div className="min-w-0">
            <p className="text-white text-sm font-bold truncate max-w-[150px] leading-tight">{match.name}</p>
            <p className="text-muted text-[10px] font-semibold leading-tight">
              {innings.inningsNumber === 1 ? '1st Innings' : '2nd Innings'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(`/match/${match.id}/scorecard`)} className="flex items-center justify-center w-9 h-9 rounded-xl text-muted hover:text-white hover:bg-pitch-light/60 transition-all" aria-label="Scorecard">
            <ClipboardList size={19} />
          </button>
          {/* ⋮ overflow menu */}
          <div className="relative">
            <button
              onClick={() => setShowMenu((v) => !v)}
              className="flex items-center gap-1.5 px-3 h-9 rounded-xl bg-pitch-light border border-white/10 text-white text-[12px] font-bold hover:border-white/30 transition-all"
              aria-label="Match options"
            >
              Options <MoreVertical size={14} />
            </button>
            {showMenu && (
              <>
                {/* Backdrop to close menu on outside tap */}
                <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
                <div className="absolute right-0 top-10 z-50 w-52 bg-pitch-light border border-white/10 rounded-2xl shadow-xl overflow-hidden">
                  <MenuAction
                    label={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    sub="Change app appearance"
                    onClick={() => { setShowMenu(false); toggleTheme(); }}
                  />
                  <MenuAction
                    label="Innings Settings"
                    sub="Update overs & last-man-stands"
                    onClick={() => { setShowMenu(false); setShowInningsSettings(true); }}
                  />
                  <MenuAction
                    label={innings.inningsNumber === 1 ? 'Close 1st Innings' : 'Close 2nd Innings'}
                    sub={innings.inningsNumber === 1 ? 'Declare or abandon 1st inn' : 'Declare or end match'}
                    onClick={() => { setShowMenu(false); setShowCloseInnings(true); }}
                  />
                  <MenuAction
                    label="End Match"
                    sub="Select winner or no result"
                    danger
                    onClick={() => { setShowMenu(false); setShowCloseMatch(true); }}
                  />
                  <div className="border-t border-white/10" />
                  <MenuAction
                    label="Leave Scoring"
                    sub="Match stays saved"
                    onClick={() => { setShowMenu(false); setShowPauseConfirm(true); }}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── SCROLLABLE: All info panels + batting order ──
           Keeping everything above ball buttons in one scrollable region
           ensures the fixed bottom (ball buttons) always fits on screen,
           including on small phones like iPhone SE (375×667). ── */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Scoreboard */}
        <Scoreboard match={match} innings={innings} stats={stats} inn1Stats={inn1Stats ?? undefined} lastDelivery={lastDelivery} />

        {/* Batsman panel */}
        <div className="px-3 pb-2">
          <BatsmanPanel
            match={match}
            innings={innings}
            stats={stats}
            onRotateStrike={rotateStrike}
            onChangeBatsman={(pos) => { setChangeBatsmanContext('voluntary'); setChangeBatsmanPosition(pos); }}
          />
        </div>

        {/* Bowler panel, or single-player over info */}
        <div className="px-3 pb-2">
          {match.config.isSinglePlayerMode ? (
            <div className="bg-pitch-light rounded-xl flex items-center gap-4 px-4 py-2.5">
              <span className="text-[11px] font-bold text-muted uppercase tracking-wide">Over</span>
              <span className="font-bold text-white text-lg">{stats.overs + 1}</span>
              <span className="text-muted text-xs font-mono">{stats.balls} / 6 balls</span>
            </div>
          ) : (
            <BowlerPanel
              match={match}
              innings={innings}
              stats={stats}
              onChangeBowler={() => setShowChangeBowler(true)}
            />
          )}
        </div>

        {/* Over tracker */}
        <OverTracker deliveries={deliveries} currentOverIndex={stats.overs} />

        {/* Batting order — now scrollable alongside panels, not hidden behind them */}
        <BattingOrderPanel match={match} innings={innings} stats={stats} />
      </div>

      {/* Sticky bottom: undo + ball buttons + pending prompts */}
      <div className="shrink-0 bg-pitch border-t border-white/[0.06]">
        <UndoBar lastDelivery={lastDelivery} onUndo={handleUndo} />

        {needsBowlerSelection && (
          <div className="px-4 pb-4 pt-1 space-y-1">
            <Button variant="gold" size="lg" fullWidth onClick={() => setShowNewOver(true)}>
              Select Opening Bowler
            </Button>
            <p className="text-muted text-xs text-center">Choose who bowls the first over to start scoring</p>
          </div>
        )}
        {needsBatsmanSelection && !needsBowlerSelection && (
          <div className="px-4 pb-4 pt-1">
            <Button
              variant="gold"
              size="lg"
              fullWidth
              onClick={() => {
                const slot = innings.currentBatsmanIds[0] === '' || innings.currentBatsmanIds[0] == null ? 0 : 1;
                setChangeBatsmanContext('post_wicket');
                setChangeBatsmanPosition(slot as 0 | 1);
              }}
            >
              Select Next Batsman
            </Button>
          </div>
        )}

        {/* Only show ball buttons when no selection is pending */}
        {!ballsDisabled && (
          <BallButtons
            onRun={handleRun}
            onWicket={() => setShowWicket(true)}
            onWide={() => setExtrasType('wide')}
            onNoBall={() => setExtrasType('no_ball')}
            onBye={() => setExtrasType('bye')}
            onLegBye={() => setExtrasType('leg_bye')}
            onToggleFreeHit={toggleFreeHit}
            freeHitActive={!!(innings.freeHitPending)}
            disabled={false}
          />
        )}
      </div>

      {/* Modals */}
      <WicketModal
        isOpen={showWicket}
        match={match}
        innings={innings}
        stats={stats}
        isFreeHit={!!(innings.freeHitPending)}
        onConfirm={handleWicketConfirm}
        onRetireHurt={handleRetireHurt}
        onCancel={() => setShowWicket(false)}
      />

      {extrasType && (
        <ExtrasModal
          isOpen
          type={extrasType}
          onConfirm={handleExtrasConfirm}
          onCancel={() => setExtrasType(null)}
        />
      )}

      <NewOverModal
        isOpen={showNewOver}
        match={match}
        innings={innings}
        stats={stats}
        completedOverRuns={completedOverRuns}
        completedOverWickets={completedOverWickets}
        onSelect={handleNewOverBowler}
        onAddBowler={handleAddBowlerToTeam}
      />

      {inn1Stats && (
        <InningsBreakModal
          isOpen={showInningsBreak}
          match={match}
          completedInnings={innings}
          inn1Stats={inn1Stats}
          onStart={handleInningsBreakStart}
        />
      )}

      <Modal isOpen={showPauseConfirm} onClose={() => setShowPauseConfirm(false)} title="Leave Scoring?">
        <p className="text-muted text-sm text-center mb-4">Your match is saved. You can resume it from the Home screen.</p>
        <div className="flex gap-3">
          <Button variant="secondary" fullWidth onClick={() => setShowPauseConfirm(false)}>Stay</Button>
          <Button variant="gold" fullWidth onClick={() => navigate('/')}>Go to Home</Button>
        </div>
      </Modal>

      <Modal isOpen={showInningsSettings} onClose={() => setShowInningsSettings(false)} title="Innings Settings">
        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted font-semibold">Total Overs (match)</label>
            <input
              type="number"
              min={Math.max(1, stats.overs + 1)}
              value={settingsOvers}
              onChange={(e) => setSettingsOvers(e.target.value)}
              className="mt-1 w-full bg-pitch border border-pitch-light rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-gold/50"
            />
            <p className="text-[11px] text-muted mt-1">Current over: {stats.overs + 1}. You can only increase total overs.</p>
          </div>
          <label className="flex items-center justify-between bg-pitch border border-pitch-light rounded-xl px-4 py-3">
            <span className="text-sm text-white font-semibold">Last Man Stands</span>
            <input type="checkbox" checked={settingsLastManStands} onChange={(e) => setSettingsLastManStands(e.target.checked)} />
          </label>
          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={() => setShowInningsSettings(false)}>Cancel</Button>
            <Button
              variant="gold"
              fullWidth
              onClick={async () => {
                const parsedOvers = Number(settingsOvers);
                if (!match || !Number.isFinite(parsedOvers)) return;
                const minOvers = Math.max(1, stats.overs + (stats.balls > 0 ? 1 : 0));
                if (parsedOvers < minOvers) {
                  addToast(`Overs must be at least ${minOvers}`, 'error');
                  return;
                }
                const updatedMatch: Match = {
                  ...match,
                  config: { ...match.config, overs: parsedOvers },
                  rules: { ...match.rules, lastManStands: settingsLastManStands },
                };
                await upsertMatch(updatedMatch);
                await loadInnings(updatedMatch, innings);
                setShowInningsSettings(false);
                addToast('Innings settings updated', 'success');
              }}
            >
              Save
            </Button>
          </div>
        </div>
      </Modal>

      {changeBatsmanPosition !== null && (
        <ChangeBatsmanModal
          isOpen
          position={changeBatsmanPosition}
          context={changeBatsmanContext}
          match={match}
          innings={innings}
          stats={stats}
          onConfirm={handleChangeBatsman}
          onRecall={handleRecallRetired}
          onClose={() => setChangeBatsmanPosition(null)}
        />
      )}

      <ChangeBowlerModal
        isOpen={showChangeBowler}
        match={match}
        innings={innings}
        stats={stats}
        onConfirm={handleChangeBowler}
        onAddBowler={handleAddBowlerToTeam}
        onClose={() => setShowChangeBowler(false)}
      />

      <CloseInningsModal
        isOpen={showCloseInnings}
        inningsNumber={innings.inningsNumber}
        currentScore={formatScore(stats.totalRuns, stats.wickets)}
        onConfirm={handleCloseInnings}
        onClose={() => setShowCloseInnings(false)}
      />

      <CloseMatchModal
        isOpen={showCloseMatch}
        teams={match.teams}
        onConfirm={handleCloseMatch}
        onClose={() => setShowCloseMatch(false)}
      />

      {/* Full-screen event flash — sits above everything, pointer-events none */}
      <EventFlash />
    </div>
  );
}

function MenuAction({
  label,
  sub,
  danger = false,
  onClick,
}: {
  label: string;
  sub: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex flex-col items-start px-4 py-3 hover:bg-pitch/60 transition-colors text-left ${danger ? 'hover:bg-wicket/10' : ''}`}
    >
      <span className={`text-sm font-semibold ${danger ? 'text-wicket' : 'text-white'}`}>{label}</span>
      <span className="text-xs text-muted mt-0.5">{sub}</span>
    </button>
  );
}
