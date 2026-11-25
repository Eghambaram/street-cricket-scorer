import { db } from '@/db/database';
import type { SavedTeam, SavedPlayer } from '@/types/player.types';

export async function getAllSavedTeams(): Promise<SavedTeam[]> {
  return db.savedTeams.orderBy('createdAt').reverse().toArray();
}

export async function getSavedTeam(id: string): Promise<SavedTeam | undefined> {
  return db.savedTeams.get(id);
}

export async function saveSavedTeam(team: SavedTeam): Promise<void> {
  await db.savedTeams.put(team);
}

export async function deleteSavedTeam(id: string): Promise<void> {
  await db.savedTeams.delete(id);
}

export async function addPlayerToTeam(teamId: string, player: SavedPlayer): Promise<void> {
  const team = await db.savedTeams.get(teamId);
  if (!team) return;
  await db.savedTeams.put({
    ...team,
    players: [...team.players, player],
    updatedAt: Date.now(),
  });
}

export async function removePlayerFromTeam(teamId: string, playerId: string): Promise<void> {
  const team = await db.savedTeams.get(teamId);
  if (!team) return;
  await db.savedTeams.put({
    ...team,
    players: team.players.filter((p) => p.id !== playerId),
    updatedAt: Date.now(),
  });
}

export async function updatePlayerInTeam(
  teamId: string,
  playerId: string,
  updates: Partial<Pick<SavedPlayer, 'name' | 'role' | 'skillLevel'>>,
): Promise<void> {
  const team = await db.savedTeams.get(teamId);
  if (!team) return;
  await db.savedTeams.put({
    ...team,
    players: team.players.map((p) => (p.id === playerId ? { ...p, ...updates } : p)),
    updatedAt: Date.now(),
  });
}
