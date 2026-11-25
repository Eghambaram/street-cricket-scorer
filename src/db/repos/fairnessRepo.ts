import { db } from '@/db/database';
import type { FairnessHistory } from '@/types/season.types';

const HISTORY_ID = 'default';

export async function getFairnessHistory(): Promise<FairnessHistory> {
  return (await db.fairnessHistory.get(HISTORY_ID)) ?? { id: HISTORY_ID, generation: 0, players: {} };
}

export async function saveFairnessHistory(history: Omit<FairnessHistory, 'id'>): Promise<void> {
  await db.fairnessHistory.put({ ...history, id: HISTORY_ID });
}
