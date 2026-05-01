import { useTeamsStore } from '@/store/teamsStore';

export function useTeams() {
  return useTeamsStore();
}
