/**
 * Fair team split — port of the Wacky Cricket Club "Fair Shuffle" generator (V4/V5).
 *
 * 1. Captains: each team's first pick is the player with the fewest captaincies,
 *    skipping anyone who captained in the last COOLDOWN_GENS recorded generations
 *    (the cooldown shrinks only when nobody else is available). Ties are random.
 * 2. Order: the rest are drawn by a weighted shuffle that favours players who have
 *    landed in the top half of the order less than 50% of the time.
 * 3. Split: drawn players go, in order, to whichever team is currently smallest.
 *
 * History is keyed by saved player id. Guests are never recorded and are only
 * made captain when no roster player is available.
 */
import type { FairnessHistory, FairnessRecord } from '@/types/season.types';

export const COOLDOWN_GENS = 3;
const NEVER = -999999;

type History = Pick<FairnessHistory, 'generation' | 'players'>;

export interface FairPlayer { id: string; name: string }

export interface FairSplitResult<P extends FairPlayer> {
  teams: P[][];
  captainIds: string[];
  orderedIds: string[];   // captains first, then the drawn order
  relaxed: boolean;       // cooldown had to be shortened
}

const blankRecord = (): FairnessRecord => ({ firstCount: 0, lastFirstGeneration: NEVER, topDraws: 0, totalDraws: 0 });

export function recordFor(history: History, id: string): FairnessRecord {
  return history.players[id] ?? blankRecord();
}

function pickCaptain<P extends FairPlayer>(candidates: P[], history: History, rng: () => number) {
  const gap = (p: P) => history.generation - recordFor(history, p.id).lastFirstGeneration;
  let cooldown = COOLDOWN_GENS;
  while (cooldown >= 1 && !candidates.some((p) => gap(p) > cooldown)) cooldown -= 1;
  const eligible = cooldown === 0 ? candidates : candidates.filter((p) => gap(p) > cooldown);
  const minCount = Math.min(...eligible.map((p) => recordFor(history, p.id).firstCount));
  const lowest = eligible.filter((p) => recordFor(history, p.id).firstCount === minCount);
  return { chosen: lowest[Math.floor(rng() * lowest.length)], relaxed: cooldown < COOLDOWN_GENS };
}

function weightedShuffle<P extends FairPlayer>(players: P[], history: History, rng: () => number): P[] {
  const expectedTopRate = 0.5;
  let pool = players.map((player) => {
    const h = recordFor(history, player.id);
    const topRate = h.totalDraws ? h.topDraws / h.totalDraws : expectedTopRate;
    const underExposureBoost = Math.max(0, expectedTopRate - topRate) * 1.8;
    const overExposurePenalty = Math.max(0, topRate - expectedTopRate) * 2.6;
    const recencyStability = 1 / Math.sqrt(h.totalDraws + 1);
    const weight = Math.max(0.05, 1 + underExposureBoost + recencyStability - overExposurePenalty) * (0.85 + rng() * 0.3);
    return { player, weight };
  });
  const result: P[] = [];
  while (pool.length) {
    const total = pool.reduce((s, x) => s + x.weight, 0);
    let r = rng() * total;
    let index = pool.length - 1;
    for (let i = 0; i < pool.length; i++) {
      r -= pool[i].weight;
      if (r <= 0) { index = i; break; }
    }
    result.push(pool[index].player);
    pool = pool.filter((_, i) => i !== index);
  }
  return result;
}

export function makeFairTeams<P extends FairPlayer>(
  players: P[],
  teamCount: 2 | 3,
  history: History,
  isRosterPlayer: (id: string) => boolean,
  rng: () => number = Math.random,
): FairSplitResult<P> {
  const n = Math.min(teamCount, players.length);
  const teams: P[][] = Array.from({ length: n }, () => []);
  const captainIds: string[] = [];
  let remaining = [...players];
  let relaxed = false;

  for (let i = 0; i < n; i++) {
    const rosterCandidates = remaining.filter((p) => isRosterPlayer(p.id));
    const pick = pickCaptain(rosterCandidates.length ? rosterCandidates : remaining, history, rng);
    teams[i].push(pick.chosen);
    captainIds.push(pick.chosen.id);
    relaxed = relaxed || pick.relaxed;
    remaining = remaining.filter((p) => p.id !== pick.chosen.id);
  }

  const rest = weightedShuffle(remaining, history, rng);
  for (const player of rest) {
    const minSize = Math.min(...teams.map((t) => t.length));
    teams[teams.findIndex((t) => t.length === minSize)].push(player);
  }

  return { teams, captainIds, orderedIds: [...captainIds, ...rest.map((p) => p.id)], relaxed };
}

/** Record a generation that was actually played. Guests (non-roster ids) are skipped. */
export function recordGeneration(
  history: History,
  captainIds: string[],
  orderedIds: string[],
  isRosterPlayer: (id: string) => boolean,
): History {
  const generation = history.generation + 1;
  const players = { ...history.players };
  const topCount = Math.ceil(orderedIds.length / 2);
  orderedIds.forEach((id, idx) => {
    if (!isRosterPlayer(id)) return;
    const h = { ...recordFor(history, id) };
    h.totalDraws += 1;
    if (idx < topCount) h.topDraws += 1;
    players[id] = h;
  });
  captainIds.forEach((id) => {
    if (!isRosterPlayer(id)) return;
    players[id] = { ...players[id] ?? blankRecord(), firstCount: (players[id]?.firstCount ?? 0) + 1, lastFirstGeneration: generation };
  });
  return { generation, players };
}

/** Generations left before the player can captain again (0 = ready). */
export function cooldownRemaining(history: History, id: string): number {
  const h = recordFor(history, id);
  if (h.lastFirstGeneration < 0) return 0;
  return Math.max(0, COOLDOWN_GENS - (history.generation - h.lastFirstGeneration) + 1);
}

/**
 * Import the HTML generator's exported history (keyed by player name) and map
 * names onto roster ids. Unknown names are reported, not imported.
 */
export function importLegacyHistory(
  raw: unknown,
  idForName: (name: string) => string | undefined,
): { history: History; unmatched: string[] } {
  const root = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const source = (root.history && typeof root.history === 'object' ? root.history : root) as Record<string, unknown>;
  const rawPlayers = (source.players && typeof source.players === 'object' ? source.players : {}) as Record<string, Record<string, unknown>>;
  const players: Record<string, FairnessRecord> = {};
  const unmatched: string[] = [];
  for (const [name, rec] of Object.entries(rawPlayers)) {
    const id = idForName(name);
    if (!id) { if (name.trim()) unmatched.push(name.trim()); continue; }
    players[id] = {
      firstCount: Number(rec.firstCount) || 0,
      lastFirstGeneration: Number(rec.lastFirstGeneration ?? rec.lastFirstGen ?? NEVER) || NEVER,
      topDraws: Number(rec.topDraws) || 0,
      totalDraws: Number(rec.totalDraws) || 0,
    };
  }
  return { history: { generation: Number(source.generation ?? source.totalGenerations) || 0, players }, unmatched };
}
