import { describe, expect, it } from 'vitest';
import type { FairnessRecord } from '@/types/season.types';
import { cooldownRemaining, importLegacyHistory, makeFairTeams, recordGeneration } from '@/utils/fairSplit';

const players = Array.from({ length: 11 }, (_, i) => ({ id: `p${i}`, name: `Name ${i}` }));
const allRoster = () => true;
const empty: { generation: number; players: Record<string, FairnessRecord> } = { generation: 0, players: {} };

describe('makeFairTeams', () => {
  it('places every player exactly once with balanced sizes', () => {
    for (const n of [2, 3] as const) {
      const { teams, captainIds, orderedIds } = makeFairTeams(players, n, empty, allRoster);
      const flat = teams.flat().map((p) => p.id);
      expect(new Set(flat).size).toBe(players.length);
      expect(flat).toHaveLength(players.length);
      const sizes = teams.map((t) => t.length);
      expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
      expect(teams.map((t) => t[0].id)).toEqual(captainIds);
      expect(orderedIds).toHaveLength(players.length);
    }
  });

  it('never repeats a captain within the cooldown while others are available', () => {
    let history = empty;
    const recent: string[][] = [];
    for (let g = 0; g < 30; g++) {
      const { captainIds, orderedIds } = makeFairTeams(players, 2, history, allRoster);
      recent.slice(-3).flat().forEach((id) => expect(captainIds).not.toContain(id));
      recent.push(captainIds);
      history = recordGeneration(history, captainIds, orderedIds, allRoster);
    }
    const counts = players.map((p) => history.players[p.id].firstCount);
    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1);
  });

  it('prefers roster players as captains and does not record guests', () => {
    const isRoster = (id: string) => id !== 'p0' && id !== 'p1';
    const guestHistory = { generation: 5, players: {} };
    const { captainIds, orderedIds } = makeFairTeams(players, 2, guestHistory, isRoster);
    expect(captainIds).not.toContain('p0');
    expect(captainIds).not.toContain('p1');
    const next = recordGeneration(guestHistory, captainIds, orderedIds, isRoster);
    expect(next.players.p0).toBeUndefined();
    expect(next.generation).toBe(6);
  });
});

describe('cooldownRemaining', () => {
  it('counts down from the last captaincy', () => {
    const h = { generation: 4, players: { a: { firstCount: 1, lastFirstGeneration: 4, topDraws: 1, totalDraws: 1 } } };
    expect(cooldownRemaining(h, 'a')).toBe(4);
    expect(cooldownRemaining({ ...h, generation: 8 }, 'a')).toBe(0);
    expect(cooldownRemaining(h, 'unknown')).toBe(0);
  });
});

describe('importLegacyHistory', () => {
  it('maps HTML export names to roster ids and reports unknown names', () => {
    const exported = {
      version: 4,
      history: {
        generation: 12,
        players: {
          Egha: { firstCount: 3, lastFirstGeneration: 11, topDraws: 6, totalDraws: 10 },
          Stranger: { firstCount: 1, lastFirstGeneration: 2, topDraws: 1, totalDraws: 2 },
        },
      },
    };
    const { history, unmatched } = importLegacyHistory(exported, (n) => (n.toLowerCase() === 'egha' ? 'id-egha' : undefined));
    expect(history.generation).toBe(12);
    expect(history.players['id-egha']).toEqual({ firstCount: 3, lastFirstGeneration: 11, topDraws: 6, totalDraws: 10 });
    expect(unmatched).toEqual(['Stranger']);
  });
});
