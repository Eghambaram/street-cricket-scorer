import { describe, expect, it } from 'vitest';
import { countsForStats, defaultSeasonRange, getActiveSeason } from '@/utils/season';
import { buildRosterIndex, linkToRoster } from '@/utils/roster';
import type { Match } from '@/types/match.types';

const match = (over: Partial<Match>): Match => ({
  id: 'm', name: 'm', createdAt: 0, status: 'completed', inningsIds: [],
  config: { overs: 5, ballsPerOver: 6, playersPerSide: 6, ballType: 'tennis', isSinglePlayerMode: false },
  rules: { lastManStands: false, oneTipOneHand: false, noLBW: false, noByes: false, retiredHurtAllowed: false, maxOversPerBowler: 0, powerPlayOvers: 0, freeHitMode: 'none' },
  teams: [{ id: 'a', name: 'A', players: [] }, { id: 'b', name: 'B', players: [] }],
  result: { winnerId: 'a', margin: 5, marginType: 'runs', resultText: 'A won by 5 runs' },
  ...over,
});

describe('countsForStats', () => {
  it('counts only completed, non-abandoned matches tagged with the season', () => {
    expect(countsForStats(match({ seasonId: 's1' }), 's1')).toBe(true);
    expect(countsForStats(match({}), 's1')).toBe(false);                       // casual
    expect(countsForStats(match({ seasonId: 's2' }), 's1')).toBe(false);       // other season
    expect(countsForStats(match({ seasonId: 's1', status: 'innings_2' }), 's1')).toBe(false);
    expect(countsForStats(match({ seasonId: 's1', result: { winnerId: null, margin: 0, marginType: 'tie', resultText: 'Match Abandoned' } }), 's1')).toBe(false);
    expect(countsForStats(match({}))).toBe(true);                              // all matches
  });
});

describe('seasons', () => {
  it('defaults to a 3-month range and finds the active season', () => {
    const now = new Date(2026, 11, 1, 15).getTime();
    const { startAt, endAt } = defaultSeasonRange(now);
    expect(new Date(startAt).getDate()).toBe(1);
    expect(new Date(endAt).getMonth()).toBe(1); // ends 28 Feb
    const s = { id: 's1', name: 'Season 1', startAt, endAt, createdAt: now };
    expect(getActiveSeason([s], now)?.id).toBe('s1');
    expect(getActiveSeason([s], endAt + 1)).toBeUndefined();
  });
});

describe('linkToRoster', () => {
  it('reuses roster ids for typed names and leaves guests alone', () => {
    const roster = buildRosterIndex([{ id: 't', name: 'Club', createdAt: 0, updatedAt: 0, players: [{ id: 'r-egha', name: 'Egha' }] }]);
    const { players, remap } = linkToRoster(
      [{ id: 'x1', name: ' egha ' }, { id: 'x2', name: 'Visitor' }],
      roster,
      new Set(['x1', 'x2']),
    );
    expect(players.map((p) => p.id)).toEqual(['r-egha', 'x2']);
    expect(remap.get('x1')).toBe('r-egha');
  });
});
