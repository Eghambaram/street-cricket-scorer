import { describe, expect, it } from 'vitest';
import { computeAwardsData, podium, weekOf, AWARD_CATEGORIES, SEASON_QUALIFICATION } from '@/utils/awards';
import type { Delivery, Wicket } from '@/types/delivery.types';
import type { Innings, Match } from '@/types/match.types';
import type { PlayerTotals } from '@/types/awards.types';

const DAY = 86_400_000;
const seasonStart = new Date(2026, 11, 1).getTime();
const season = { id: 's1', name: 'Season 1', startAt: seasonStart, endAt: seasonStart + 90 * DAY, createdAt: 0 };

let seq = 0;
const ball = (inningsId: string, over: number, batsmanId: string, bowlerId: string, runs: number, extra: Partial<Delivery['extras']> = {}, wicket?: Wicket): Delivery => {
  const extras = { wide: 0, noBall: 0, bye: 0, legBye: 0, ...extra };
  return { id: `d${seq++}`, inningsId, overIndex: over, ballIndex: 0, deliverySequence: seq, batsmanId, bowlerId, runs, extras, totalRuns: runs + extras.wide + extras.noBall + extras.bye + extras.legBye, wicket, timestamp: 0 };
};

const match = (id: string, day: number, over: Partial<Match> = {}): Match => ({
  id, name: id, createdAt: seasonStart + day * DAY + 3600_000, status: 'completed', inningsIds: [`${id}-i1`], seasonId: 's1',
  config: { overs: 5, ballsPerOver: 6, playersPerSide: 3, ballType: 'tennis', isSinglePlayerMode: false },
  rules: { lastManStands: false, oneTipOneHand: false, noLBW: false, noByes: false, retiredHurtAllowed: false, maxOversPerBowler: 0, powerPlayOvers: 0 },
  teams: [
    { id: 'A', name: 'Team A', players: [{ id: 'bat', name: 'Batter', teamId: 'A' }, { id: 'guest', name: 'Guest', teamId: 'A' }] },
    { id: 'B', name: 'Team B', players: [{ id: 'bowl', name: 'Bowler', teamId: 'B' }, { id: 'field', name: 'Fielder', teamId: 'B' }] },
  ],
  result: { winnerId: 'A', margin: 1, marginType: 'runs', resultText: 'Team A won by 1 run' },
  ...over,
});

const innings = (matchId: string): Innings => ({
  id: `${matchId}-i1`, matchId, inningsNumber: 1, battingTeamId: 'A', bowlingTeamId: 'B', status: 'completed',
  currentBatsmanIds: ['bat', null], strikerIndex: 0, currentBowlerId: null, battingOrder: ['bat'],
});

const roster = [
  { id: 'bat', name: 'Batter' },
  { id: 'bowl', name: 'Bowler' },
  { id: 'field', name: 'Fielder' },
];

describe('computeAwardsData', () => {
  const m1 = match('m1', 0);
  const m2 = match('m2', 8); // week 2
  const dels = [
    // m1: a maiden over to "bat", then a six, then caught by Fielder for... batter already scored
    ...Array.from({ length: 6 }, () => ball('m1-i1', 0, 'bat', 'bowl', 0)),
    ball('m1-i1', 1, 'bat', 'bowl', 6),
    ball('m1-i1', 1, 'bat', 'bowl', 0, { wide: 1 }),
    ball('m1-i1', 1, 'bat', 'bowl', 4, {}, { type: 'caught', fielderId: 'field' }),
    // m2: out first ball (duck), run out credit to Fielder
    ball('m2-i1', 0, 'bat', 'bowl', 0, {}, { type: 'run_out', fielderId: 'field', runOutBatsmanId: 'bat' }),
  ];
  const data = computeAwardsData({ matches: [m1, m2], innings: [innings('m1'), innings('m2')], deliveries: dels, roster, season });

  it('builds one row per roster player per match and skips guests', () => {
    expect(data.rows).toHaveLength(6);
    expect(data.rows.some((r) => r.playerId === 'guest')).toBe(false);
    expect(data.weeksWithMatches).toEqual([1, 2]);
  });

  it('totals batting, bowling and fielding', () => {
    const bat = data.totals.find((t) => t.playerId === 'bat')!;
    expect(bat).toMatchObject({ matches: 2, innings: 2, runs: 10, ballsFaced: 9, sixes: 1, fours: 1, dismissals: 2, ducks: 1, highScore: 10 });
    const bowl = data.totals.find((t) => t.playerId === 'bowl')!;
    expect(bowl).toMatchObject({ wickets: 1, maidens: 1, legalBallsBowled: 9, runsConceded: 11, extrasConceded: 1, dotBalls: 7, bestWickets: 1, bestRuns: 11 });
    const field = data.totals.find((t) => t.playerId === 'field')!;
    expect(field).toMatchObject({ catches: 1, runouts: 1, mvp: 20 });
  });

  it('filters to a single week', () => {
    const w2 = computeAwardsData({ matches: [m1, m2], innings: [innings('m1'), innings('m2')], deliveries: dels, roster, season, week: 2 });
    expect(w2.matchCount).toBe(1);
    expect(w2.totals.find((t) => t.playerId === 'bat')!.runs).toBe(0);
  });

  it('ignores casual and abandoned matches', () => {
    const casual = match('m3', 1, { seasonId: undefined });
    const abandoned = match('m4', 2, { result: { winnerId: null, margin: 0, marginType: 'tie', resultText: 'Match Abandoned' } });
    const out = computeAwardsData({ matches: [casual, abandoned], innings: [], deliveries: [], roster, season });
    expect(out.matchCount).toBe(0);
  });
});

describe('podium', () => {
  const t = (id: string, runs: number): PlayerTotals => ({
    playerId: id, playerName: id, matches: 1, innings: 1, runs, ballsFaced: 10, fours: 0, sixes: 0, highScore: runs,
    notOuts: 0, dismissals: 1, wickets: 0, maidens: 0, legalBallsBowled: 0, runsConceded: 0, bestWickets: 0, bestRuns: 0,
    catches: 0, runouts: 0, stumpings: 0, dotBalls: 0, ducks: 0, extrasConceded: 0, battingAvg: runs, strikeRate: runs * 10, economy: null, mvp: runs,
  });
  const runMachine = AWARD_CATEGORIES[0].rule!;

  it('shares tied places and skips the next place (1, 2, 2 → no 3rd)', () => {
    const places = podium([t('A', 50), t('B', 30), t('C', 30), t('D', 20)], runMachine, SEASON_QUALIFICATION);
    expect(places.map((p) => [p.position, p.players.map((x) => x.id)])).toEqual([[1, ['A']], [2, ['B', 'C']]]);
  });

  it('applies qualification to rate awards', () => {
    const avg = AWARD_CATEGORIES[4].rule!;
    const short = { ...t('A', 80), ballsFaced: 12 };
    expect(podium([short, t('B', 40)], avg, { minBallsFaced: 30, minBallsBowled: 36 })).toEqual([]);
    expect(podium([short], avg, { minBallsFaced: 10, minBallsBowled: 12 })[0].players[0].id).toBe('A');
  });
});

describe('weekOf', () => {
  it('counts 7-day blocks from the season start', () => {
    expect(weekOf(seasonStart, seasonStart)).toBe(1);
    expect(weekOf(seasonStart + 6 * DAY + 23 * 3600_000, seasonStart)).toBe(1);
    expect(weekOf(seasonStart + 7 * DAY, seasonStart)).toBe(2);
  });
});
