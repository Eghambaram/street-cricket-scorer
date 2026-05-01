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

export async function getActiveMatch(): Promise<Match | undefined> {
  return db.matches
    .where('status')
    .anyOf(['toss', 'innings_1', 'innings_break', 'innings_2'])
    .first();
}
