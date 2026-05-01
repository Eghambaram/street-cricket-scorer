export type WicketType =
  | 'bowled'
  | 'caught'
  | 'run_out'
  | 'stumped'
  | 'hit_wicket'
  | 'lbw'
  | 'handled_ball'
  | 'obstructing_field'
  | 'one_tip_one_hand';

export interface Wicket {
  type: WicketType;
  fielderId?: string;         // catcher / stumper / run-out fielder
  runOutBatsmanId?: string;   // which batsman is out (run out: could be non-striker)
}

export interface DeliveryExtras {
  wide: number;   // 0 = not wide; >0 = wide penalty (1) + any runs batsmen ran
  noBall: number; // 0 = not no-ball; 1 = no-ball penalty; batsman runs in delivery.runs
  bye: number;    // runs as byes (credited to extras, legal delivery)
  legBye: number; // runs as leg byes (credited to extras, legal delivery)
}

export interface Delivery {
  id: string;
  inningsId: string;
  overIndex: number;        // 0-based over number
  ballIndex: number;        // 0-based legal ball within the over (0–5)
  deliverySequence: number; // absolute sequence including all extras re-bowls
  batsmanId: string;
  bowlerId: string;
  runs: number;             // runs credited to batsman (0 for wides)
  extras: DeliveryExtras;
  totalRuns: number;        // runs + all extras combined
  wicket?: Wicket;
  isFreeHit?: boolean;   // true when this delivery was bowled as a free hit
  timestamp: number;
}

export interface FallOfWicket {
  wicketNumber: number;
  runs: number;        // team score when wicket fell
  legalBalls: number;  // legal balls bowled when wicket fell
  batsmanId: string;
}

export interface OverSummary {
  overIndex: number;
  bowlerId: string;
  runs: number;          // runs in this over (charged to bowler)
  wickets: number;
  extras: number;
  isMaiden: boolean;
  deliveries: Delivery[];
}

export interface InningsStats {
  totalRuns: number;
  wickets: number;
  legalBalls: number;
  overs: number;
  balls: number;          // remainder balls in current over
  extras: { wides: number; noBalls: number; byes: number; legByes: number };
  extrasTotal: number;
  batsmanScores: Record<string, import('./player.types').BatsmanScore>;
  bowlerScores: Record<string, import('./player.types').BowlerScore>;
  fallOfWickets: FallOfWicket[];
  overSummaries: OverSummary[];
}
