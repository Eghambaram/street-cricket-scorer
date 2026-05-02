export interface Player {
  id: string;
  name: string;
  teamId: string;
}

export type PlayerRole = 'batsman' | 'bowler' | 'allrounder' | 'wicketkeeper';

export type SkillLevel = 'low' | 'medium' | 'high';

export interface SavedPlayer {
  id: string;
  name: string;
  role?: PlayerRole;
  skillLevel?: SkillLevel;
  statsBaselineAt?: number;  // epoch ms — stats counted from this date for this player
}

export interface SavedTeam {
  id: string;
  name: string;
  players: SavedPlayer[];
  createdAt: number;
  updatedAt: number;
  statsBaselineAt?: number;  // epoch ms — team-wide session start; overridden per player
}

export interface BatsmanScore {
  playerId: string;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  isOut: boolean;
  dismissalText: string;   // e.g. "c Priya b Ajay", "run out (Meera)"
  strikeRate: number;
}

export interface BowlerScore {
  playerId: string;
  legalBalls: number;      // for computing overs (legalBalls / 6)
  runs: number;            // runs charged to bowler (batsman runs + wide/no-ball extras)
  wickets: number;
  maidens: number;
  economy: number;
}
