import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { SavedTeam, SavedPlayer, PlayerRole } from '@/types/player.types';
import {
  getAllSavedTeams,
  saveSavedTeam,
  deleteSavedTeam,
  addPlayerToTeam,
  removePlayerFromTeam,
  updatePlayerInTeam,
  resetPlayerBaseline,
  resetTeamBaseline,
  clearPlayerBaseline,
  clearTeamBaseline,
} from '@/db/repos/savedTeamRepo';

interface TeamsState {
  teams: SavedTeam[];
  loading: boolean;
  loadTeams: () => Promise<void>;
  createTeam: (name: string) => Promise<SavedTeam>;
  updateTeam: (team: SavedTeam) => Promise<void>;
  removeTeam: (id: string) => Promise<void>;
  addPlayer: (teamId: string, name: string, role?: PlayerRole) => Promise<void>;
  removePlayer: (teamId: string, playerId: string) => Promise<void>;
  updatePlayer: (teamId: string, playerId: string, updates: Partial<Pick<SavedPlayer, 'name' | 'role'>>) => Promise<void>;
  resetPlayerStats: (teamId: string, playerId: string) => Promise<void>;
  resetTeamStats: (teamId: string) => Promise<void>;
  clearPlayerStats: (teamId: string, playerId: string) => Promise<void>;
  clearTeamStats: (teamId: string) => Promise<void>;
}

export const useTeamsStore = create<TeamsState>((set) => ({
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

  addPlayer: async (teamId: string, name: string, role?: PlayerRole) => {
    const player: SavedPlayer = { id: uuid(), name: name.trim(), role };
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

  updatePlayer: async (teamId, playerId, updates) => {
    await updatePlayerInTeam(teamId, playerId, updates);
    set((s) => ({
      teams: s.teams.map((t) =>
        t.id === teamId
          ? {
              ...t,
              players: t.players.map((p) => (p.id === playerId ? { ...p, ...updates } : p)),
              updatedAt: Date.now(),
            }
          : t,
      ),
    }));
  },

  resetPlayerStats: async (teamId, playerId) => {
    await resetPlayerBaseline(teamId, playerId);
    const now = Date.now();
    set((s) => ({
      teams: s.teams.map((t) =>
        t.id === teamId
          ? { ...t, players: t.players.map((p) => p.id === playerId ? { ...p, statsBaselineAt: now } : p), updatedAt: now }
          : t,
      ),
    }));
  },

  resetTeamStats: async (teamId) => {
    await resetTeamBaseline(teamId);
    const now = Date.now();
    set((s) => ({
      teams: s.teams.map((t) =>
        t.id === teamId
          ? { ...t, statsBaselineAt: now, players: t.players.map((p) => ({ ...p, statsBaselineAt: now })), updatedAt: now }
          : t,
      ),
    }));
  },

  clearPlayerStats: async (teamId, playerId) => {
    await clearPlayerBaseline(teamId, playerId);
    const now = Date.now();
    set((s) => ({
      teams: s.teams.map((t) =>
        t.id === teamId
          ? { ...t, players: t.players.map((p) => p.id === playerId ? { ...p, statsBaselineAt: undefined } : p), updatedAt: now }
          : t,
      ),
    }));
  },

  clearTeamStats: async (teamId) => {
    await clearTeamBaseline(teamId);
    const now = Date.now();
    set((s) => ({
      teams: s.teams.map((t) =>
        t.id === teamId
          ? { ...t, statsBaselineAt: undefined, players: t.players.map((p) => ({ ...p, statsBaselineAt: undefined })), updatedAt: now }
          : t,
      ),
    }));
  },
}));
