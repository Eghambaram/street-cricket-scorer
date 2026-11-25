import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { Season } from '@/types/season.types';
import { getAllSeasons, saveSeason, deleteSeason } from '@/db/repos/seasonRepo';

interface SeasonState {
  seasons: Season[];
  loaded: boolean;
  loadSeasons: () => Promise<void>;
  createSeason: (name: string, startAt: number, endAt: number) => Promise<Season>;
  updateSeason: (season: Season) => Promise<void>;
  removeSeason: (id: string) => Promise<void>;
}

const byStartDesc = (a: Season, b: Season) => b.startAt - a.startAt;

export const useSeasonStore = create<SeasonState>((set) => ({
  seasons: [],
  loaded: false,

  loadSeasons: async () => {
    const seasons = await getAllSeasons();
    set({ seasons, loaded: true });
  },

  createSeason: async (name, startAt, endAt) => {
    const season: Season = { id: uuid(), name: name.trim(), startAt, endAt, createdAt: Date.now() };
    await saveSeason(season);
    set((s) => ({ seasons: [...s.seasons, season].sort(byStartDesc) }));
    return season;
  },

  updateSeason: async (season) => {
    await saveSeason(season);
    set((s) => ({ seasons: s.seasons.map((x) => (x.id === season.id ? season : x)).sort(byStartDesc) }));
  },

  removeSeason: async (id) => {
    await deleteSeason(id);
    set((s) => ({ seasons: s.seasons.filter((x) => x.id !== id) }));
  },
}));
