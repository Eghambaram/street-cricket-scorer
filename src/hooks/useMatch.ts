import { useMatchStore } from '@/store/matchStore';
import { getMatch } from '@/db/repos/matchRepo';
import type { Match } from '@/types/match.types';

export function useMatch() {
  const { matches, activeMatch, loading, loadMatches, loadActiveMatch, upsertMatch, removeMatch, setActiveMatch } =
    useMatchStore();

  const refreshMatch = async (id: string) => {
    const fresh = await getMatch(id);
    if (fresh) setActiveMatch(fresh);
    return fresh;
  };

  const updateMatchStatus = async (match: Match, status: Match['status']) => {
    const updated = { ...match, status };
    await upsertMatch(updated);
    return updated;
  };

  return {
    matches,
    activeMatch,
    loading,
    loadMatches,
    loadActiveMatch,
    upsertMatch,
    removeMatch,
    setActiveMatch,
    refreshMatch,
    updateMatchStatus,
  };
}
