import { db } from '@/db/database';
import type { Match } from '@/types/match.types';

export async function getAllMatches(): Promise<Match[]> {
  return db.matches.orderBy('createdAt').reverse().toArray();
}

export async function getMatch(id: string): Promise<Match | undefined> {
  return db.matches.get(id);
}

export async function saveMatch(match: Match): Promise<void> {
  await db.matches.put(match);
}

export async function deleteMatch(id: string): Promise<void> {
  const innings = await db.innings.where('matchId').equals(id).toArray();
  const inningsIds = innings.map((i) => i.id);
  await db.transaction('rw', db.matches, db.innings, db.deliveries, async () => {
    await db.deliveries.where('inningsId').anyOf(inningsIds).delete();
    await db.innings.where('matchId').equals(id).delete();
    await db.matches.delete(id);
  });
}

/** Last time anything happened in a match: its latest delivery, or creation time if no balls yet. */
export async function getMatchLastActivity(match: Match): Promise<number> {
  if (match.inningsIds.length === 0) return match.createdAt;
  const deliveries = await db.deliveries.where('inningsId').anyOf(match.inningsIds).toArray();
  return deliveries.reduce((latest, d) => Math.max(latest, d.timestamp), match.createdAt);
}

/**
 * The unfinished match the user most recently played, with its last activity time.
 * Several matches can be unfinished (app closed mid-match, then a new match
 * started), so pick by recency — `.first()` on the status index returns them
 * in random uuid order and could surface a days-old match.
 */
export async function getActiveMatch(): Promise<{ match: Match; lastActivity: number } | undefined> {
  const unfinished = await db.matches
    .where('status')
    .anyOf(['toss', 'innings_1', 'innings_break', 'innings_2'])
    .toArray();
  if (unfinished.length === 0) return undefined;

  const withActivity = await Promise.all(
    unfinished.map(async (match) => ({ match, lastActivity: await getMatchLastActivity(match) })),
  );
  return withActivity.reduce((a, b) => (b.lastActivity > a.lastActivity ? b : a));
}
