/** One player's line for one match — a row of the "Match Log" sheet. */
export interface MatchLogRow {
  week: number;
  date: number;               // match createdAt (epoch ms)
  matchId: string;
  matchName: string;
  playerId: string;
  playerName: string;
  teamName: string;
  result: string;
  batted: boolean;            // faced a ball or was dismissed
  runs: number;
  ballsFaced: number;         // wides excluded
  fours: number;
  sixes: number;
  notOut: boolean;            // only meaningful when batted
  wickets: number;            // bowler's wickets (run outs excluded)
  legalBallsBowled: number;
  maidens: number;
  runsConceded: number;       // bat runs + wides + no-balls
  catches: number;            // caught + one-tip-one-hand
  runouts: number;
  stumpings: number;
  dotBalls: number;           // legal balls bowled with no runs off the bat
  duck: boolean;              // out for 0
  extrasConceded: number;     // wides + no-balls bowled
}

/** Season (or week) totals for one player — a row of the "Leaderboard" sheet. */
export interface PlayerTotals {
  playerId: string;
  playerName: string;
  matches: number;
  innings: number;
  runs: number;
  ballsFaced: number;
  fours: number;
  sixes: number;
  highScore: number;
  notOuts: number;
  dismissals: number;
  wickets: number;
  maidens: number;
  legalBallsBowled: number;
  runsConceded: number;
  bestWickets: number;        // best figures in one match
  bestRuns: number;
  catches: number;
  runouts: number;
  stumpings: number;
  dotBalls: number;
  ducks: number;
  extrasConceded: number;
  battingAvg: number | null;  // null until dismissed at least once
  strikeRate: number | null;
  economy: number | null;
  mvp: number;                // runs + 20×wkts + 10×(catches + run outs + stumpings)
}

export type AwardKind = 'stat' | 'special';

export interface AwardCategory {
  no: number;
  name: string;
  basis: string;
  kind: AwardKind;
  group: 'Batting' | 'Bowling' | 'Fielding & All-round' | 'Special';
}

export interface AwardPlace {
  position: 1 | 2 | 3;
  players: { id: string; name: string }[];  // more than one = shared (tie)
  value: string;
}

export interface AwardResult {
  category: AwardCategory;
  places: AwardPlace[];       // empty for special awards / no qualifier
  note?: string;              // e.g. qualification rule
}

/** Minimum volume before rate awards (average, strike rate, economy) rank a player. */
export interface Qualification {
  minBallsFaced: number;
  minBallsBowled: number;
}

export interface AwardsData {
  rows: MatchLogRow[];
  totals: PlayerTotals[];
  awards: AwardResult[];
  matchCount: number;
  qualification: Qualification;
  /** Weeks (1-based) that have at least one counted match, across the whole scope. */
  weeksWithMatches: number[];
}
