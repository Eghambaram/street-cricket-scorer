import { db } from '@/db/database';
import type { Innings } from '@/types/match.types';

export async function getInnings(id: string): Promise<Innings | undefined> {
  return db.innings.get(id);
}

export async function getMatchInnings(matchId: string): Promise<Innings[]> {
  return db.innings.where('matchId').equals(matchId).sortBy('inningsNumber');
}

export async function saveInnings(innings: Innings): Promise<void> {
  await db.innings.put(innings);
}

export async function getAllInnings(): Promise<Innings[]> {
  return db.innings.toArray();
}
