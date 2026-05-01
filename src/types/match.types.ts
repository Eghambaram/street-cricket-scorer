import type { Player } from './player.types';
import type { StreetCricketRules } from './rules.types';

export type MatchStatus =
  | 'setup'
  | 'toss'
  | 'innings_1'
  | 'innings_break'
  | 'innings_2'
  | 'completed';

export type InningsStatus = 'active' | 'completed';

export type InningsCompletedReason =
  | 'all_out'
  | 'overs_complete'
  | 'target_achieved'
  | 'tie'
  | 'declared'
  | 'abandoned';

export interface MatchConfig {
  overs: number;           // 1–50
  ballsPerOver: number;    // always 6
  playersPerSide: number;  // 2–11
  ballType: 'tennis' | 'tape' | 'rubber' | 'leather';
  isSinglePlayerMode: boolean;
}

export interface Team {
  id: string;
  name: string;
  players: Player[];
}

export interface Toss {
  winnerTeamId: string;
  choice: 'bat' | 'bowl';
}

export interface MatchResult {
  winnerId: string | null;       // null = tie
  margin: number;
  marginType: 'runs' | 'wickets' | 'tie';
  resultText: string;            // "Team A won by 23 runs"
  manOfTheMatchId?: string;
}

export interface Innings {
  id: string;
  matchId: string;
  inningsNumber: 1 | 2;
  battingTeamId: string;
  bowlingTeamId: string;
  status: InningsStatus;
  completedReason?: InningsCompletedReason;
  // Live state (updated after each delivery)
  currentBatsmanIds: [string, string | null]; // [striker, non-striker]
  strikerIndex: 0 | 1;
  currentBowlerId: string | null;
  battingOrder: string[];        // player IDs in order they came in
  retiredHurtIds?: string[];     // batsmen currently retired hurt; can return
  freeHitPending?: boolean;      // next legal delivery is a free hit
  consecutiveExtrasCount?: number; // consecutive wides/no-balls in a row (for two_consecutive_extras mode)
}

export interface Match {
  id: string;
  name: string;
  createdAt: number;
  status: MatchStatus;
  config: MatchConfig;
  rules: StreetCricketRules;
  toss?: Toss;
  teams: [Team, Team];
  inningsIds: string[];
  result?: MatchResult;
}

export const DEFAULT_CONFIG: MatchConfig = {
  overs: 5,
  ballsPerOver: 6,
  playersPerSide: 6,
  ballType: 'tennis',
  isSinglePlayerMode: false,
};
