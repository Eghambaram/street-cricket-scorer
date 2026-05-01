import type { Delivery, InningsStats, FallOfWicket, OverSummary } from '@/types/delivery.types';
import type { BatsmanScore, BowlerScore } from '@/types/player.types';

export function isLegalDelivery(d: Delivery): boolean {
  return d.extras.wide === 0 && d.extras.noBall === 0;
}

/** Compute full innings statistics from the raw deliveries array.
 *  @param resolveName  Optional function to map a player ID → display name.
 *                      When omitted, dismissalText will contain raw player IDs.
 */
export function computeInningsStats(
  deliveries: Delivery[],
  resolveName?: (id: string) => string,
): InningsStats {
  const nameOf = resolveName ?? ((id: string) => id);
  let totalRuns = 0;
  let wickets = 0;
  let legalBalls = 0;
  const extras = { wides: 0, noBalls: 0, byes: 0, legByes: 0 };
  const batsmanScores: Record<string, BatsmanScore> = {};
  const bowlerScores: Record<string, BowlerScore> = {};
  const fallOfWickets: FallOfWicket[] = [];

  // Group deliveries by over for maiden detection
  const oversByBowler: Record<string, Map<number, Delivery[]>> = {};

  for (const d of deliveries) {
    const isWide = d.extras.wide > 0;
    const isNoBall = d.extras.noBall > 0;
    const isLegal = !isWide && !isNoBall;

    // Total runs for the delivery
    const deliveryTotal =
      d.runs + d.extras.wide + d.extras.noBall + d.extras.bye + d.extras.legBye;
    totalRuns += deliveryTotal;

    extras.wides += d.extras.wide;
    extras.noBalls += d.extras.noBall;
    extras.byes += d.extras.bye;
    extras.legByes += d.extras.legBye;

    // Batsman stats (not credited on wides)
    if (!isWide) {
      if (!batsmanScores[d.batsmanId]) {
        batsmanScores[d.batsmanId] = initBatsman(d.batsmanId);
      }
      const bs = batsmanScores[d.batsmanId];
      bs.runs += d.runs;
      // No-balls are free deliveries — don't count toward balls faced
      if (!isNoBall) bs.balls += 1;
      if (d.runs === 4) bs.fours += 1;
      if (d.runs === 6) bs.sixes += 1;
    }

    // Bowler stats
    if (!bowlerScores[d.bowlerId]) {
      bowlerScores[d.bowlerId] = initBowler(d.bowlerId);
    }
    const bwl = bowlerScores[d.bowlerId];
    // Runs charged: batsman runs + wide penalty + no-ball penalty (NOT byes/leg byes)
    bwl.runs += d.runs + d.extras.wide + d.extras.noBall;
    if (isLegal) bwl.legalBalls += 1;

    // Legal ball count
    if (isLegal) legalBalls += 1;

    // Wicket handling
    if (d.wicket) {
      wickets += 1;
      const dismissedId = d.wicket.runOutBatsmanId ?? d.batsmanId;
      if (!batsmanScores[dismissedId]) {
        batsmanScores[dismissedId] = initBatsman(dismissedId);
      }
      batsmanScores[dismissedId].isOut = true;
      batsmanScores[dismissedId].dismissalText = buildDismissalText(d, nameOf);

      // Wicket credited to bowler (not for run-outs, handled ball, obstructing)
      const noCreditTypes = ['run_out', 'handled_ball', 'obstructing_field'];
      if (!noCreditTypes.includes(d.wicket.type)) {
        bwl.wickets += 1;
      }

      fallOfWickets.push({
        wicketNumber: wickets,
        runs: totalRuns,
        legalBalls,
        batsmanId: dismissedId,
      });
    }

    // Group by bowler+over for maiden check
    if (!oversByBowler[d.bowlerId]) oversByBowler[d.bowlerId] = new Map();
    const overMap = oversByBowler[d.bowlerId];
    const existing = overMap.get(d.overIndex) ?? [];
    existing.push(d);
    overMap.set(d.overIndex, existing);
  }

  // Compute maidens (over must have 6 legal balls, 0 runs charged to bowler)
  for (const [bowlerId, overs] of Object.entries(oversByBowler)) {
    for (const [, dels] of overs.entries()) {
      const legalCount = dels.filter(isLegalDelivery).length;
      if (legalCount === 6) {
        const runsCharged = dels.reduce(
          (s, d) => s + d.runs + d.extras.wide + d.extras.noBall,
          0
        );
        if (runsCharged === 0 && bowlerScores[bowlerId]) {
          bowlerScores[bowlerId].maidens += 1;
        }
      }
    }
  }

  // Finalise derived fields
  for (const bs of Object.values(batsmanScores)) {
    bs.strikeRate = bs.balls > 0 ? parseFloat(((bs.runs / bs.balls) * 100).toFixed(1)) : 0;
  }
  for (const bwl of Object.values(bowlerScores)) {
    const oversFloat = bwl.legalBalls / 6;
    bwl.economy = oversFloat > 0 ? parseFloat((bwl.runs / oversFloat).toFixed(1)) : 0;
  }

  // Build over summaries
  const overSummaries = buildOverSummaries(deliveries);

  const extrasTotal = extras.wides + extras.noBalls + extras.byes + extras.legByes;

  return {
    totalRuns,
    wickets,
    legalBalls,
    overs: Math.floor(legalBalls / 6),
    balls: legalBalls % 6,
    extras,
    extrasTotal,
    batsmanScores,
    bowlerScores,
    fallOfWickets,
    overSummaries,
  };
}

function initBatsman(playerId: string): BatsmanScore {
  return { playerId, runs: 0, balls: 0, fours: 0, sixes: 0, isOut: false, dismissalText: '', strikeRate: 0 };
}

function initBowler(playerId: string): BowlerScore {
  return { playerId, legalBalls: 0, runs: 0, wickets: 0, maidens: 0, economy: 0 };
}

function buildDismissalText(d: Delivery, nameOf: (id: string) => string): string {
  if (!d.wicket) return '';
  const bow = nameOf(d.bowlerId);
  const fld = d.wicket.fielderId ? nameOf(d.wicket.fielderId) : '?';
  switch (d.wicket.type) {
    case 'bowled': return `b ${bow}`;
    case 'caught': return `c ${fld} b ${bow}`;
    case 'run_out': return `run out (${fld})`;
    case 'stumped': return `st ${fld} b ${bow}`;
    case 'hit_wicket': return `hit wicket b ${bow}`;
    case 'lbw': return `lbw b ${bow}`;
    case 'one_tip_one_hand': return `1T1H ${fld} b ${bow}`;
    default: return d.wicket.type.replace(/_/g, ' ');
  }
}

function buildOverSummaries(deliveries: Delivery[]): OverSummary[] {
  const map = new Map<number, Delivery[]>();
  for (const d of deliveries) {
    const list = map.get(d.overIndex) ?? [];
    list.push(d);
    map.set(d.overIndex, list);
  }
  const summaries: OverSummary[] = [];
  for (const [overIndex, dels] of map.entries()) {
    const bowlerId = dels[0].bowlerId;
    const runs = dels.reduce((s, d) => s + d.runs + d.extras.wide + d.extras.noBall, 0);
    const wickets = dels.filter((d) => d.wicket).length;
    const extrasCount = dels.filter(
      (d) => d.extras.wide > 0 || d.extras.noBall > 0 || d.extras.bye > 0 || d.extras.legBye > 0
    ).length;
    const legalCount = dels.filter(isLegalDelivery).length;
    summaries.push({
      overIndex,
      bowlerId,
      runs,
      wickets,
      extras: extrasCount,
      isMaiden: legalCount === 6 && runs === 0,
      deliveries: dels,
    });
  }
  return summaries.sort((a, b) => a.overIndex - b.overIndex);
}

/** Compute next striker index after a delivery. */
export function computeNextStrikerIndex(
  currentStrikerIndex: 0 | 1,
  batsmanRuns: number,
  isWide: boolean,
  isEndOfOver: boolean
): 0 | 1 {
  let striker = currentStrikerIndex;
  // Wide: runs batsmen physically ran = extras.wide - 1 (subtract the penalty)
  // But for strike rotation we only care if they crossed: odd total running runs
  const runsForRotation = isWide ? 0 : batsmanRuns; // wide: batsman runs = 0, no rotation from bat
  if (runsForRotation % 2 === 1) {
    striker = (striker ^ 1) as 0 | 1;
  }
  // End of over: always rotate (teams swap ends)
  if (isEndOfOver) {
    striker = (striker ^ 1) as 0 | 1;
  }
  return striker;
}

/** After adding a delivery, determine if the over is now complete. */
export function isOverComplete(deliveries: Delivery[]): boolean {
  const lastDelivery = deliveries[deliveries.length - 1];
  if (!lastDelivery) return false;
  const currentOverDeliveries = deliveries.filter((d) => d.overIndex === lastDelivery.overIndex);
  const legalCount = currentOverDeliveries.filter(isLegalDelivery).length;
  return legalCount === 6;
}

/** Determine if innings is over (all out or overs complete). */
export function isInningsOver(
  stats: InningsStats,
  maxOvers: number,
  playersPerSide: number,
  lastManStands: boolean
): boolean {
  const maxWickets = lastManStands ? playersPerSide : playersPerSide - 1;
  if (stats.wickets >= maxWickets) return true;
  if (stats.overs >= maxOvers && stats.balls === 0 && stats.legalBalls > 0) return true;
  return false;
}

export function computeRunRate(runs: number, legalBalls: number): number {
  if (legalBalls === 0) return 0;
  return parseFloat(((runs / legalBalls) * 6).toFixed(2));
}

export function computeRequiredRunRate(
  target: number,
  currentRuns: number,
  remainingBalls: number
): number {
  const needed = target - currentRuns;
  if (remainingBalls <= 0) return needed > 0 ? 999.99 : 0;
  return parseFloat(((needed / remainingBalls) * 6).toFixed(2));
}

export function computeProjectedScore(runs: number, legalBalls: number, totalBalls: number): number {
  if (legalBalls === 0) return 0;
  return Math.round((runs / legalBalls) * totalBalls);
}

export function buildResultText(
  winnerName: string | null,
  margin: number,
  marginType: 'runs' | 'wickets' | 'tie'
): string {
  if (marginType === 'tie') return 'Match Tied';
  if (marginType === 'runs') return `${winnerName} won by ${margin} run${margin !== 1 ? 's' : ''}`;
  return `${winnerName} won by ${margin} wicket${margin !== 1 ? 's' : ''}`;
}

/** How many overs a bowler has bowled (as a display string like "3.4"). */
export function bowlerOversDisplay(legalBalls: number): string {
  const overs = Math.floor(legalBalls / 6);
  const balls = legalBalls % 6;
  return balls === 0 ? `${overs}` : `${overs}.${balls}`;
}

/** Format overs as "8.3 / 10". */
export function formatOvers(legalBalls: number, maxOvers: number): string {
  return `${Math.floor(legalBalls / 6)}.${legalBalls % 6} / ${maxOvers}`;
}

/** Get ball display symbol for the over tracker. */
export function ballSymbol(d: Delivery): string {
  if (d.wicket) return 'W';
  if (d.extras.wide > 0) return d.runs > 0 ? `${d.extras.wide}Wd` : 'Wd';
  if (d.extras.noBall > 0) return d.runs > 0 ? `${d.runs}nb` : 'NB';
  if (d.extras.bye > 0) return `${d.extras.bye}b`;
  if (d.extras.legBye > 0) return `${d.extras.legBye}lb`;
  if (d.runs === 0) return '·';
  return String(d.runs);
}

/** Colour class for the over tracker badge.
 *  Semantic mapping (cricket-color-system spec):
 *  Wicket chip → amber (W badge) | SIX chip → coral red | FOUR → cyan
 *  1-3 runs → lime green | Wide → violet | NoBall → orange | Dot → muted
 */
export function ballBadgeClass(d: Delivery): string {
  // Free-hit wicket = not out → teal
  if (d.wicket && d.isFreeHit) return 'bg-safe/20 text-safe border border-safe/40';
  // Wicket chip — amber (W badge; WICKET button stays coral red)
  if (d.wicket)                return 'bg-amber/20 text-amber border border-amber/50 font-black';
  // Free hit (no wicket) — teal ring
  if (d.isFreeHit)             return 'bg-safe/20 text-safe border-2 border-safe/50';
  // Wide — violet (spec: accent-wide); must precede run checks
  if (d.extras.wide > 0)       return 'bg-wide/15 text-wide border border-wide/35';
  // No Ball — orange (spec: accent-nb); must precede run checks so 4nb / 6nb stay orange
  if (d.extras.noBall > 0)     return 'bg-noball/20 text-noball border border-noball/40';
  // SIX — coral red (spec: accent-six)
  if (d.runs === 6)            return 'bg-six/20 text-six border border-six/40';
  // FOUR — cyan boundary
  if (d.runs === 4)            return 'bg-four/20 text-four border border-four/40';
  // Byes / leg-byes — muted (passive extras, lower visual weight)
  if (d.extras.bye > 0 || d.extras.legBye > 0) return 'bg-pitch-light text-muted border border-pitch-light';
  // Dot ball — neutral muted
  if (d.runs === 0)            return 'bg-pitch-light text-muted/50 border border-dashed border-muted/20';
  // 1–3 runs — lime green (positive scoring)
  return 'bg-runs/15 text-runs border border-runs/30';
}
