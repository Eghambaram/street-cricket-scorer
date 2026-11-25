import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { SavedTeam, SavedPlayer, PlayerRole, SkillLevel } from '@/types/player.types';
import {
  getAllSavedTeams,
  saveSavedTeam,
  deleteSavedTeam,
  addPlayerToTeam,
  removePlayerFromTeam,
  updatePlayerInTeam,
} from '@/db/repos/savedTeamRepo';

interface TeamsState {
  teams: SavedTeam[];
  loading: boolean;
  loadTeams: () => Promise<void>;
  createTeam: (name: string) => Promise<SavedTeam>;
  updateTeam: (team: SavedTeam) => Promise<void>;
  removeTeam: (id: string) => Promise<void>;
  /** Pass `id` to add an existing club player (same person in another squad). */
  addPlayer: (teamId: string, name: string, role?: PlayerRole, skillLevel?: SkillLevel, id?: string) => Promise<void>;
  removePlayer: (teamId: string, playerId: string) => Promise<void>;
  updatePlayer: (teamId: string, playerId: string, updates: Partial<Pick<SavedPlayer, 'name' | 'role' | 'skillLevel'>>) => Promise<void>;
}

export const useTeamsStore = create<TeamsState>((set, get) => ({
  teams: [],
  loading: false,

  loadTeams: async () => {
    set({ loading: true });
    const teams = await getAllSavedTeams();
    set({ teams, loading: false });
  },

  createTeam: async (name: string) => {
    const team: SavedTeam = {
      id: uuid(),
      name: name.trim(),
      players: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    await saveSavedTeam(team);
    set((s) => ({ teams: [team, ...s.teams] }));
    return team;
  },

  updateTeam: async (team: SavedTeam) => {
    const updated = { ...team, updatedAt: Date.now() };
    await saveSavedTeam(updated);
    set((s) => ({ teams: s.teams.map((t) => (t.id === team.id ? updated : t)) }));
  },

  removeTeam: async (id: string) => {
    await deleteSavedTeam(id);
    set((s) => ({ teams: s.teams.filter((t) => t.id !== id) }));
  },

  addPlayer: async (teamId: string, name: string, role?: PlayerRole, skillLevel?: SkillLevel, id?: string) => {
    const player: SavedPlayer = { id: id ?? uuid(), name: name.trim(), role, skillLevel };
    await addPlayerToTeam(teamId, player);
    set((s) => ({
      teams: s.teams.map((t) =>
        t.id === teamId
          ? { ...t, players: [...t.players, player], updatedAt: Date.now() }
          : t,
      ),
    }));
  },

  removePlayer: async (teamId: string, playerId: string) => {
    await removePlayerFromTeam(teamId, playerId);
    set((s) => ({
      teams: s.teams.map((t) =>
        t.id === teamId
          ? { ...t, players: t.players.filter((p) => p.id !== playerId), updatedAt: Date.now() }
          : t,
      ),
    }));
  },

  // A player can sit in several squads under one id; a rename follows them
  // everywhere so name matching and stats stay consistent.
  updatePlayer: async (teamId, playerId, updates) => {
    const nameOnly = updates.name !== undefined ? { name: updates.name } : {};
    const changesFor = (id: string) => (id === teamId ? updates : nameOnly);
    const affected = get().teams.filter((t) => t.players.some((p) => p.id === playerId));
    for (const t of affected) await updatePlayerInTeam(t.id, playerId, changesFor(t.id));
    const now = Date.now();
    set((s) => ({
      teams: s.teams.map((t) =>
        affected.some((a) => a.id === t.id)
          ? {
              ...t,
              players: t.players.map((p) => (p.id === playerId ? { ...p, ...changesFor(t.id) } : p)),
              updatedAt: now,
            }
          : t,
      ),
    }));
  },
}));
