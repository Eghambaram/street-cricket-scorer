import { create } from 'zustand';
import type { Match } from '@/types/match.types';
import { getAllMatches, saveMatch, deleteMatch, getActiveMatch } from '@/db/repos/matchRepo';

interface MatchState {
  matches: Match[];
  activeMatch: Match | null;
  loading: boolean;
  loadMatches: () => Promise<void>;
  loadActiveMatch: () => Promise<void>;
  upsertMatch: (match: Match) => Promise<void>;
  removeMatch: (id: string) => Promise<void>;
  setActiveMatch: (match: Match | null) => void;
}

export const useMatchStore = create<MatchState>((set, get) => ({
  matches: [],
  activeMatch: null,
  loading: false,

  loadMatches: async () => {
    set({ loading: true });
    const matches = await getAllMatches();
    set({ matches, loading: false });
  },

  loadActiveMatch: async () => {
    const active = await getActiveMatch();
    set({ activeMatch: active ?? null });
  },

  upsertMatch: async (match) => {
    await saveMatch(match);
    const matches = await getAllMatches();
    set({ matches, activeMatch: match.status !== 'completed' && match.status !== 'setup' ? match : get().activeMatch });
  },

  removeMatch: async (id) => {
    await deleteMatch(id);
    const matches = await getAllMatches();
    set({ matches, activeMatch: get().activeMatch?.id === id ? null : get().activeMatch });
  },

  setActiveMatch: (match) => set({ activeMatch: match }),
}));
