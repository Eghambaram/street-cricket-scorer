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
  updates: Partial<Pick<SavedPlayer, 'name' | 'role'>>,
): Promise<void> {
  const team = await db.savedTeams.get(teamId);
  if (!team) return;
  await db.savedTeams.put({
    ...team,
    players: team.players.map((p) => (p.id === playerId ? { ...p, ...updates } : p)),
    updatedAt: Date.now(),
  });
}

/** Reset stats baseline for a single player to now. */
export async function resetPlayerBaseline(teamId: string, playerId: string): Promise<void> {
  const team = await db.savedTeams.get(teamId);
  if (!team) return;
  const now = Date.now();
  await db.savedTeams.put({
    ...team,
    players: team.players.map((p) =>
      p.id === playerId ? { ...p, statsBaselineAt: now } : p,
    ),
    updatedAt: now,
  });
}

/** Reset stats baseline for every player in a team to now. */
export async function resetTeamBaseline(teamId: string): Promise<void> {
  const team = await db.savedTeams.get(teamId);
  if (!team) return;
  const now = Date.now();
  await db.savedTeams.put({
    ...team,
    statsBaselineAt: now,
    players: team.players.map((p) => ({ ...p, statsBaselineAt: now })),
    updatedAt: now,
  });
}

/** Clear baselines — restore full history view. */
export async function clearPlayerBaseline(teamId: string, playerId: string): Promise<void> {
  const team = await db.savedTeams.get(teamId);
  if (!team) return;
  const now = Date.now();
  await db.savedTeams.put({
    ...team,
    players: team.players.map((p) =>
      p.id === playerId ? { ...p, statsBaselineAt: undefined } : p,
    ),
    updatedAt: now,
  });
}

export async function clearTeamBaseline(teamId: string): Promise<void> {
  const team = await db.savedTeams.get(teamId);
  if (!team) return;
  await db.savedTeams.put({
    ...team,
    statsBaselineAt: undefined,
    players: team.players.map((p) => ({ ...p, statsBaselineAt: undefined })),
    updatedAt: Date.now(),
  });
}
