import { create } from 'zustand';
import type { Match } from '@/types/match.types';
import { getAllMatches, saveMatch, deleteMatch, getActiveMatch } from '@/db/repos/matchRepo';

interface MatchState {
  matches: Match[];
  activeMatch: Match | null;
  /** When the active match was last played (latest ball, or creation). */
  activeMatchLastActivity: number | null;
  loading: boolean;
  loadMatches: () => Promise<void>;
  loadActiveMatch: () => Promise<void>;
  upsertMatch: (match: Match) => Promise<void>;
  removeMatch: (id: string) => Promise<void>;
  setActiveMatch: (match: Match | null) => void;
}

const isUnfinished = (match: Match) => match.status !== 'completed' && match.status !== 'setup';

export const useMatchStore = create<MatchState>((set, get) => ({
  matches: [],
  activeMatch: null,
  activeMatchLastActivity: null,
  loading: false,

  loadMatches: async () => {
    set({ loading: true });
    const matches = await getAllMatches();
    set({ matches, loading: false });
  },

  loadActiveMatch: async () => {
    const active = await getActiveMatch();
    set({ activeMatch: active?.match ?? null, activeMatchLastActivity: active?.lastActivity ?? null });
  },

  upsertMatch: async (match) => {
    await saveMatch(match);
    const matches = await getAllMatches();
    set({ matches });
    if (isUnfinished(match)) {
      set({ activeMatch: match, activeMatchLastActivity: Date.now() });
    } else if (get().activeMatch?.id === match.id) {
      // The active match just finished — don't keep showing it as live; fall
      // back to whichever other unfinished match (if any) was played most recently.
      await get().loadActiveMatch();
    }
  },

  removeMatch: async (id) => {
    await deleteMatch(id);
    const matches = await getAllMatches();
    set({ matches });
    if (get().activeMatch?.id === id) await get().loadActiveMatch();
  },

  setActiveMatch: (match) => set({ activeMatch: match }),
}));
