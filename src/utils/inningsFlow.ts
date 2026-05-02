import type { Innings, Match } from '@/types/match.types';

export function getRemainingBatsmenCount(match: Match, innings: Innings): number {
  const battingTeam = match.teams.find((t) => t.id === innings.battingTeamId);
  if (!battingTeam) return 0;

  const usedPlayerIds = new Set([
    ...innings.battingOrder,
    ...(innings.retiredHurtIds ?? []),
  ]);

  return battingTeam.players.filter((p) => !usedPlayerIds.has(p.id)).length;
}

export function canContinueWithLoneBatter(match: Match, innings: Innings): boolean {
  if (!match.rules.lastManStands || innings.status !== 'active') return false;
  const activeBatsmen = innings.currentBatsmanIds.filter((id) => !!id && id !== '').length;
  return activeBatsmen === 1 && getRemainingBatsmenCount(match, innings) === 0;
}
