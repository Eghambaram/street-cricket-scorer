import { db } from '@/db/database';
import type { Season } from '@/types/season.types';

export async function getAllSeasons(): Promise<Season[]> {
  return db.seasons.orderBy('startAt').reverse().toArray();
}

export async function saveSeason(season: Season): Promise<void> {
  await db.seasons.put(season);
}

/** Deletes the season and turns its matches into casual matches. Match data is kept. */
export async function deleteSeason(id: string): Promise<void> {
  await db.transaction('rw', db.seasons, db.matches, async () => {
    const matches = await db.matches.where('seasonId').equals(id).toArray();
    await db.matches.bulkPut(matches.map(({ seasonId: _seasonId, ...m }) => m));
    await db.seasons.delete(id);
  });
}
