import type { Delivery } from '@/types/delivery.types';
import { getAllDeliveries } from '@/db/repos/playerRepo';
import { getAllInnings } from '@/db/repos/inningsRepo';
import { getAllMatches } from '@/db/repos/matchRepo';
import { isLegalDelivery } from '@/utils/cricket';


export interface CareerStats {
  // Batting
  battingInnings: number;
  totalRuns: number;
  highScore: number;
  notOuts: number;
  battingAverage: number;
  strikeRate: number;
  fifties: number;
  hundreds: number;
  fours: number;
  sixes: number;
  // Bowling
  bowlingInnings: number;
  wickets: number;
  runsConceded: number;
  legalBallsBowled: number;
  bowlingAverage: number;
  economy: number;
  bestBowlingWickets: number;
  bestBowlingRuns: number;
  maidens: number;
  // Matches
  matches: number;
}

/** @param since  Optional epoch ms — only deliveries from matches created at or after this. */
export async function computeCareerStats(playerId: string, since?: number): Promise<CareerStats> {
  // Single bulk fetch — no N+1 loop
  const [allDeliveries, allInnings, allMatches] = await Promise.all([
    getAllDeliveries(),
    getAllInnings(),
    getAllMatches(),
  ]);

  // Map inningsId → matchId in memory
  const inningsMatchMap = new Map<string, string>(
    allInnings.map((inn) => [inn.id, inn.matchId]),
  );

  const validMatchIds = new Set(
    allMatches
      .filter((m) => since === undefined || m.createdAt >= since)
      .map((m) => m.id),
  );

  // Collect matches where the player appeared
  const matchIds = new Set<string>();
  for (const d of allDeliveries) {
    if (d.batsmanId === playerId || d.bowlerId === playerId) {
      const matchId = inningsMatchMap.get(d.inningsId);
      if (matchId && validMatchIds.has(matchId)) matchIds.add(matchId);
    }
  }

  // Group deliveries by innings (filtered to valid matches)
  const byInnings = new Map<string, Delivery[]>();
  for (const d of allDeliveries) {
    const matchId = inningsMatchMap.get(d.inningsId);
    if (!matchId || !validMatchIds.has(matchId)) continue;
    const list = byInnings.get(d.inningsId) ?? [];
    list.push(d);
    byInnings.set(d.inningsId, list);
  }

  // Batting aggregates
  let battingInnings = 0;
  let totalRuns = 0;
  let highScore = 0;
  let notOuts = 0;
  let fifties = 0;
  let hundreds = 0;
  let fours = 0;
  let sixes = 0;
  let battingBalls = 0;

  // Bowling aggregates
  let bowlingInnings = 0;
  let wickets = 0;
  let runsConceded = 0;
  let legalBallsBowled = 0;
  let maidens = 0;
  let bestBowlingWickets = 0;
  let bestBowlingRuns = 0;

  for (const [, deliveries] of byInnings) {
    const batDels = deliveries.filter((d) => d.batsmanId === playerId && d.extras.wide === 0);
    const bowlDels = deliveries.filter((d) => d.bowlerId === playerId);

    if (batDels.length > 0) {
      battingInnings += 1;
      const inningsRuns = batDels.reduce((s, d) => s + d.runs, 0);
      const inningsBalls = batDels.length;
      const isOut = deliveries.some(
        (d) => d.wicket && (d.wicket.runOutBatsmanId === playerId || (d.batsmanId === playerId && !d.wicket.runOutBatsmanId))
      );

      totalRuns += inningsRuns;
      battingBalls += inningsBalls;
      if (inningsRuns > highScore) highScore = inningsRuns;
      if (!isOut) notOuts += 1;
      if (inningsRuns >= 100) hundreds += 1;
      else if (inningsRuns >= 50) fifties += 1;
      fours += batDels.filter((d) => d.runs === 4).length;
      sixes += batDels.filter((d) => d.runs === 6).length;
    }

    if (bowlDels.length > 0) {
      bowlingInnings += 1;
      const innWickets = bowlDels.filter((d) => {
        if (!d.wicket) return false;
        return !['run_out', 'handled_ball', 'obstructing_field'].includes(d.wicket.type);
      }).length;
      const innRuns = bowlDels.reduce((s, d) => s + d.runs + d.extras.wide + d.extras.noBall, 0);
      const innLegal = bowlDels.filter(isLegalDelivery).length;

      wickets += innWickets;
      runsConceded += innRuns;
      legalBallsBowled += innLegal;

      if (innWickets > bestBowlingWickets || (innWickets === bestBowlingWickets && innRuns < bestBowlingRuns)) {
        bestBowlingWickets = innWickets;
        bestBowlingRuns = innRuns;
      }

      const overMap = new Map<number, Delivery[]>();
      for (const d of bowlDels) {
        const list = overMap.get(d.overIndex) ?? [];
        list.push(d);
        overMap.set(d.overIndex, list);
      }
      for (const [, ods] of overMap) {
        const legalCount = ods.filter(isLegalDelivery).length;
        if (legalCount === 6) {
          const runsCharged = ods.reduce((s, d) => s + d.runs + d.extras.wide + d.extras.noBall, 0);
          if (runsCharged === 0) maidens += 1;
        }
      }
    }
  }

  const dismissals = battingInnings - notOuts;
  const battingAverage = dismissals > 0 ? parseFloat((totalRuns / dismissals).toFixed(1)) : totalRuns;
  const strikeRate = battingBalls > 0 ? parseFloat(((totalRuns / battingBalls) * 100).toFixed(1)) : 0;
  const oversFloat = legalBallsBowled / 6;
  const bowlingAverage = wickets > 0 ? parseFloat((runsConceded / wickets).toFixed(1)) : 0;
  const economy = oversFloat > 0 ? parseFloat((runsConceded / oversFloat).toFixed(1)) : 0;

  return {
    matches: matchIds.size,
    battingInnings,
    totalRuns,
    highScore,
    notOuts,
    battingAverage,
    strikeRate,
    fifties,
    hundreds,
    fours,
    sixes,
    bowlingInnings,
    wickets,
    runsConceded,
    legalBallsBowled,
    bowlingAverage,
    economy,
    bestBowlingWickets,
    bestBowlingRuns,
    maidens,
  };
}

export function formatBestBowling(wickets: number, runs: number): string {
  if (wickets === 0 && runs === 0) return '—';
  return `${wickets}/${runs}`;
}

// ─── Leaderboard bulk computation ─────────────────────────────────────────────

export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  teamName: string;
  statsBaselineAt?: number;
  stats: CareerStats;
}

/** Compute stats for every supplied player in a single bulk DB read.
 *  @param since  Optional time-range filter (epoch ms) applied globally on top of per-player baselines. */
export async function computeLeaderboard(
  playerEntries: Array<{ playerId: string; playerName: string; teamName: string; statsBaselineAt?: number }>,
  since?: number,
): Promise<LeaderboardEntry[]> {
  if (playerEntries.length === 0) return [];

  const [allDeliveries, allInnings, allMatches] = await Promise.all([
    getAllDeliveries(),
    getAllInnings(),
    getAllMatches(),
  ]);

  const inningsMatchMap = new Map<string, string>(
    allInnings.map((inn) => [inn.id, inn.matchId]),
  );

  const matchCreatedAt = new Map<string, number>(
    allMatches.map((m) => [m.id, m.createdAt]),
  );

  const completedMatchIds = new Set(
    allMatches.filter((m) => m.status === 'completed').map((m) => m.id),
  );

  // Pre-group all deliveries by innings once
  const allByInnings = new Map<string, Delivery[]>();
  for (const d of allDeliveries) {
    const list = allByInnings.get(d.inningsId) ?? [];
    list.push(d);
    allByInnings.set(d.inningsId, list);
  }

  return playerEntries.map(({ playerId, playerName, teamName, statsBaselineAt }) => {
    // Effective baseline = stricter of time-range chip OR player session reset
    const effectiveSince = Math.max(since ?? 0, statsBaselineAt ?? 0) || undefined;

    const validMatchIds = new Set(
      [...completedMatchIds].filter((id) => {
        const created = matchCreatedAt.get(id) ?? 0;
        return effectiveSince === undefined || created >= effectiveSince;
      }),
    );

    return {
      playerId,
      playerName,
      teamName,
      statsBaselineAt,
      stats: _playerStatsFromInnings(playerId, allByInnings, validMatchIds, inningsMatchMap),
    };
  });
}

function _playerStatsFromInnings(
  playerId: string,
  byInnings: Map<string, Delivery[]>,
  validMatchIds: Set<string>,
  inningsMatchMap: Map<string, string>,
): CareerStats {
  const matchIds = new Set<string>();
  let battingInnings = 0, totalRuns = 0, highScore = 0, notOuts = 0;
  let fifties = 0, hundreds = 0, fours = 0, sixes = 0, battingBalls = 0;
  let bowlingInnings = 0, wickets = 0, runsConceded = 0, legalBallsBowled = 0, maidens = 0;
  let bestBowlingWickets = 0, bestBowlingRuns = 0;

  for (const [inningsId, deliveries] of byInnings) {
    const matchId = inningsMatchMap.get(inningsId);
    if (!matchId || !validMatchIds.has(matchId)) continue;

    const batDels = deliveries.filter((d) => d.batsmanId === playerId && d.extras.wide === 0);
    const bowlDels = deliveries.filter((d) => d.bowlerId === playerId);

    if (batDels.length > 0 || bowlDels.length > 0) matchIds.add(matchId);

    if (batDels.length > 0) {
      battingInnings += 1;
      const inningsRuns = batDels.reduce((s, d) => s + d.runs, 0);
      const isOut = deliveries.some(
        (d) => d.wicket &&
          (d.wicket.runOutBatsmanId === playerId || (d.batsmanId === playerId && !d.wicket.runOutBatsmanId)),
      );
      totalRuns += inningsRuns;
      battingBalls += batDels.length;
      if (inningsRuns > highScore) highScore = inningsRuns;
      if (!isOut) notOuts += 1;
      if (inningsRuns >= 100) hundreds += 1;
      else if (inningsRuns >= 50) fifties += 1;
      fours += batDels.filter((d) => d.runs === 4).length;
      sixes += batDels.filter((d) => d.runs === 6).length;
    }

    if (bowlDels.length > 0) {
      bowlingInnings += 1;
      const innWickets = bowlDels.filter((d) => {
        if (!d.wicket) return false;
        return !['run_out', 'handled_ball', 'obstructing_field'].includes(d.wicket.type);
      }).length;
      const innRuns = bowlDels.reduce((s, d) => s + d.runs + d.extras.wide + d.extras.noBall, 0);
      const innLegal = bowlDels.filter(isLegalDelivery).length;
      wickets += innWickets;
      runsConceded += innRuns;
      legalBallsBowled += innLegal;

      if (innWickets > bestBowlingWickets ||
         (innWickets === bestBowlingWickets && innWickets > 0 && innRuns < bestBowlingRuns)) {
        bestBowlingWickets = innWickets;
        bestBowlingRuns = innRuns;
      }

      const overMap = new Map<number, Delivery[]>();
      for (const d of bowlDels) {
        const list = overMap.get(d.overIndex) ?? [];
        list.push(d);
        overMap.set(d.overIndex, list);
      }
      for (const [, ods] of overMap) {
        if (ods.filter(isLegalDelivery).length === 6) {
          const charged = ods.reduce((s, d) => s + d.runs + d.extras.wide + d.extras.noBall, 0);
          if (charged === 0) maidens += 1;
        }
      }
    }
  }

  const dismissals = battingInnings - notOuts;
  const oversFloat = legalBallsBowled / 6;

  return {
    matches: matchIds.size,
    battingInnings, totalRuns, highScore, notOuts,
    battingAverage: dismissals > 0 ? parseFloat((totalRuns / dismissals).toFixed(1)) : totalRuns,
    strikeRate: battingBalls > 0 ? parseFloat(((totalRuns / battingBalls) * 100).toFixed(1)) : 0,
    fifties, hundreds, fours, sixes,
    bowlingInnings, wickets, runsConceded, legalBallsBowled,
    bowlingAverage: wickets > 0 ? parseFloat((runsConceded / wickets).toFixed(1)) : 0,
    economy: oversFloat > 0 ? parseFloat((runsConceded / oversFloat).toFixed(1)) : 0,
    bestBowlingWickets, bestBowlingRuns, maidens,
  };
}
