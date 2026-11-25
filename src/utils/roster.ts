import type { SavedTeam } from '@/types/player.types';

const AUTO_NAME = /^player \d+$/i;

const key = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase();

/** Placeholder names ("Player 3") given to blank roster slots. */
export function isAutoName(name: string): boolean {
  return AUTO_NAME.test(name.trim());
}

/** Club roster lookup: every saved player, by id and by normalised name (first wins). */
export function buildRosterIndex(savedTeams: SavedTeam[]) {
  const ids = new Set<string>();
  const byName = new Map<string, string>();
  for (const team of savedTeams) {
    for (const p of team.players) {
      ids.add(p.id);
      const k = key(p.name);
      if (k && !byName.has(k)) byName.set(k, p.id);
    }
  }
  return {
    isRosterId: (id: string) => ids.has(id),
    idForName: (name: string) => byName.get(key(name)),
  };
}

export type RosterIndex = ReturnType<typeof buildRosterIndex>;

/**
 * Point match players at their club roster ids so their stats count. A player
 * whose name matches a roster player takes that player's id, unless the id is
 * already used in this match. Players not on the roster keep their id (guests).
 * Returns the old → new id map so captain ids can follow.
 */
export function linkToRoster<P extends { id: string; name: string }>(
  players: P[],
  roster: RosterIndex,
  usedIds: Set<string>,
): { players: P[]; remap: Map<string, string> } {
  const remap = new Map<string, string>();
  const linked = players.map((p) => {
    if (roster.isRosterId(p.id)) return p;
    const rosterId = roster.idForName(p.name);
    if (!rosterId || usedIds.has(rosterId)) return p;
    usedIds.add(rosterId);
    remap.set(p.id, rosterId);
    return { ...p, id: rosterId };
  });
  return { players: linked, remap };
}
