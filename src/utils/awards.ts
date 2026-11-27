/**
 * Season awards — per-match player lines, totals and the 20 award categories
 * (15 statistical with top 3, 5 special organizer picks), matching the club's
 * "Wacky Cricket Awards" tracker. Pure functions: callers pass in the data.
 *
 * Which matches count is the same rule as the leaderboard (`countsForStats`).
 * Only club roster players are included; guests never appear.
 */
import type { Delivery } from '@/types/delivery.types';
import type { Innings, Match } from '@/types/match.types';
import type { Season } from '@/types/season.types';
import type {
  AwardCategory, AwardPlace, AwardResult, AwardsData, MatchLogRow, PlayerTotals, Qualification,
} from '@/types/awards.types';
import { isLegalDelivery } from '@/utils/cricket';
import { countsForStats, startOfDay } from '@/utils/season';

const WEEK_MS = 7 * 86_400_000;

/** Rate awards need volume. A week is short, so its bar is lower than the season's. */
export const SEASON_QUALIFICATION: Qualification = { minBallsFaced: 30, minBallsBowled: 36 };
export const WEEK_QUALIFICATION: Qualification = { minBallsFaced: 10, minBallsBowled: 12 };

export const MVP_RULE = 'Runs + 20 × wickets + 10 × (catches + run outs + stumpings)';

const NOT_BOWLER_WICKETS = new Set(['run_out', 'handled_ball', 'obstructing_field']);

export interface RosterPlayer { id: string; name: string }

// ─── Weeks ───────────────────────────────────────────────────────────────────

/** Week number (1-based) of a date, counting 7-day blocks from the scope start. */
export function weekOf(ms: number, scopeStart: number): number {
  return Math.max(1, Math.floor((startOfDay(ms) - startOfDay(scopeStart)) / WEEK_MS) + 1);
}

export function weekRange(scopeStart: number, week: number): { start: number; end: number } {
  const start = startOfDay(scopeStart) + (week - 1) * WEEK_MS;
  return { start, end: start + WEEK_MS - 1 };
}

export function totalWeeks(season: Pick<Season, 'startAt' | 'endAt'>): number {
  return Math.max(1, Math.ceil((season.endAt - startOfDay(season.startAt) + 1) / WEEK_MS));
}

/** Where week 1 starts: the season start, or the first counted match for "all matches". */
export function scopeStartFor(matches: Match[], season?: Season): number {
  if (season) return season.startAt;
  const counted = matches.filter((m) => countsForStats(m));
  return counted.length ? Math.min(...counted.map((m) => m.createdAt)) : Date.now();
}

// ─── Match log ───────────────────────────────────────────────────────────────

function isDismissed(d: Delivery, playerId: string): boolean {
  if (!d.wicket) return false;
  return d.wicket.runOutBatsmanId ? d.wicket.runOutBatsmanId === playerId : d.batsmanId === playerId;
}

function countMaidens(bowlDels: Delivery[]): number {
  const overs = new Map<string, Delivery[]>();
  for (const d of bowlDels) {
    const key = `${d.inningsId}:${d.overIndex}`;
    overs.set(key, [...(overs.get(key) ?? []), d]);
  }
  let maidens = 0;
  for (const ods of overs.values()) {
    const charged = ods.reduce((s, d) => s + d.runs + d.extras.wide + d.extras.noBall, 0);
    if (ods.filter(isLegalDelivery).length === 6 && charged === 0) maidens += 1;
  }
  return maidens;
}

function playerLine(
  match: Match,
  teamName: string,
  player: RosterPlayer,
  dels: Delivery[],
  week: number,
): MatchLogRow {
  const pid = player.id;
  const batDels = dels.filter((d) => d.batsmanId === pid);
  const faced = batDels.filter((d) => d.extras.wide === 0);
  const dismissed = dels.some((d) => isDismissed(d, pid));
  const runs = batDels.reduce((s, d) => s + d.runs, 0);
  const bowlDels = dels.filter((d) => d.bowlerId === pid);
  const legal = bowlDels.filter(isLegalDelivery);
  const fielded = dels.filter((d) => d.wicket?.fielderId === pid);
  return {
    week,
    date: match.createdAt,
    matchId: match.id,
    matchName: match.name,
    playerId: pid,
    playerName: player.name,
    teamName,
    result: match.result?.resultText ?? '',
    batted: batDels.length > 0 || dismissed,
    runs,
    ballsFaced: faced.length,
    fours: faced.filter((d) => d.runs === 4).length,
    sixes: faced.filter((d) => d.runs === 6).length,
    notOut: !dismissed,
    wickets: bowlDels.filter((d) => d.wicket && !NOT_BOWLER_WICKETS.has(d.wicket.type)).length,
    legalBallsBowled: legal.length,
    maidens: countMaidens(bowlDels),
    runsConceded: bowlDels.reduce((s, d) => s + d.runs + d.extras.wide + d.extras.noBall, 0),
    catches: fielded.filter((d) => d.wicket?.type === 'caught' || d.wicket?.type === 'one_tip_one_hand').length,
    runouts: fielded.filter((d) => d.wicket?.type === 'run_out').length,
    stumpings: fielded.filter((d) => d.wicket?.type === 'stumped').length,
    dotBalls: legal.filter((d) => d.runs === 0).length,
    duck: dismissed && runs === 0,
    extrasConceded: bowlDels.reduce((s, d) => s + d.extras.wide + d.extras.noBall, 0),
  };
}

// ─── Totals ──────────────────────────────────────────────────────────────────

function totalsFor(player: RosterPlayer, rows: MatchLogRow[]): PlayerTotals {
  const t: PlayerTotals = {
    playerId: player.id, playerName: player.name,
    matches: rows.length, innings: 0, runs: 0, ballsFaced: 0, fours: 0, sixes: 0, highScore: 0,
    notOuts: 0, dismissals: 0, wickets: 0, maidens: 0, legalBallsBowled: 0, runsConceded: 0,
    bestWickets: 0, bestRuns: 0, catches: 0, runouts: 0, stumpings: 0, dotBalls: 0, ducks: 0,
    extrasConceded: 0, battingAvg: null, strikeRate: null, economy: null, mvp: 0,
  };
  for (const r of rows) {
    if (r.batted) {
      t.innings += 1;
      if (r.notOut) t.notOuts += 1; else t.dismissals += 1;
      t.highScore = Math.max(t.highScore, r.runs);
    }
    t.runs += r.runs; t.ballsFaced += r.ballsFaced; t.fours += r.fours; t.sixes += r.sixes;
    t.wickets += r.wickets; t.maidens += r.maidens; t.legalBallsBowled += r.legalBallsBowled;
    t.runsConceded += r.runsConceded; t.catches += r.catches; t.runouts += r.runouts;
    t.stumpings += r.stumpings; t.dotBalls += r.dotBalls; t.extrasConceded += r.extrasConceded;
    if (r.duck) t.ducks += 1;
    if (r.wickets > t.bestWickets || (r.wickets === t.bestWickets && r.wickets > 0 && r.runsConceded < t.bestRuns)) {
      t.bestWickets = r.wickets;
      t.bestRuns = r.runsConceded;
    }
  }
  t.battingAvg = t.dismissals > 0 ? t.runs / t.dismissals : null;
  t.strikeRate = t.ballsFaced > 0 ? (t.runs / t.ballsFaced) * 100 : null;
  t.economy = t.legalBallsBowled > 0 ? t.runsConceded / (t.legalBallsBowled / 6) : null;
  t.mvp = t.runs + 20 * t.wickets + 10 * (t.catches + t.runouts + t.stumpings);
  return t;
}

// ─── Award categories ────────────────────────────────────────────────────────

interface StatRule {
  eligible: (t: PlayerTotals, q: Qualification) => boolean;
  /** Negative = a ranks above b; 0 = tied. */
  cmp: (a: PlayerTotals, b: PlayerTotals) => number;
  format: (t: PlayerTotals) => string;
  note?: (q: Qualification) => string;
}

const most = (key: keyof PlayerTotals): StatRule => ({
  eligible: (t) => (t[key] as number) > 0,
  cmp: (a, b) => (b[key] as number) - (a[key] as number),
  format: (t) => String(t[key]),
});

const overs = (balls: number) => `${Math.floor(balls / 6)}.${balls % 6}`;

export const AWARD_CATEGORIES: (AwardCategory & { rule?: StatRule })[] = [
  { no: 1, name: 'Run Machine', basis: 'Most total runs', kind: 'stat', group: 'Batting', rule: most('runs') },
  { no: 2, name: 'Sixer King', basis: 'Most sixes', kind: 'stat', group: 'Batting', rule: most('sixes') },
  { no: 3, name: 'Boundary King', basis: 'Most fours', kind: 'stat', group: 'Batting', rule: most('fours') },
  { no: 4, name: 'Highest Individual Score', basis: 'Highest score in one match', kind: 'stat', group: 'Batting', rule: most('highScore') },
  {
    no: 5, name: 'Best Batting Average', basis: 'Runs ÷ times out; qualification applies', kind: 'stat', group: 'Batting',
    rule: {
      eligible: (t, q) => t.battingAvg !== null && t.ballsFaced >= q.minBallsFaced,
      cmp: (a, b) => (b.battingAvg ?? 0) - (a.battingAvg ?? 0),
      format: (t) => (t.battingAvg ?? 0).toFixed(1),
      note: (q) => `Min ${q.minBallsFaced} balls faced and out at least once`,
    },
  },
  {
    no: 6, name: 'Highest Strike Rate', basis: 'Runs ÷ balls faced × 100; qualification applies', kind: 'stat', group: 'Batting',
    rule: {
      eligible: (t, q) => t.strikeRate !== null && t.ballsFaced >= q.minBallsFaced,
      cmp: (a, b) => (b.strikeRate ?? 0) - (a.strikeRate ?? 0),
      format: (t) => (t.strikeRate ?? 0).toFixed(1),
      note: (q) => `Min ${q.minBallsFaced} balls faced`,
    },
  },
  { no: 7, name: 'Most Not Outs', basis: 'Total not-out innings', kind: 'stat', group: 'Batting', rule: most('notOuts') },
  { no: 8, name: 'Wicket Hunter', basis: 'Most wickets', kind: 'stat', group: 'Bowling', rule: most('wickets') },
  { no: 9, name: 'Maiden Over King', basis: 'Most maiden overs', kind: 'stat', group: 'Bowling', rule: most('maidens') },
  {
    no: 10, name: 'Best Bowling Figures', basis: 'Most wickets in one match; tie-break by fewer runs', kind: 'stat', group: 'Bowling',
    rule: {
      eligible: (t) => t.bestWickets > 0,
      cmp: (a, b) => b.bestWickets - a.bestWickets || a.bestRuns - b.bestRuns,
      format: (t) => `${t.bestWickets}/${t.bestRuns}`,
    },
  },
  {
    no: 11, name: 'Best Economy Rate', basis: 'Runs conceded ÷ overs; qualification applies', kind: 'stat', group: 'Bowling',
    rule: {
      eligible: (t, q) => t.economy !== null && t.legalBallsBowled >= q.minBallsBowled,
      cmp: (a, b) => (a.economy ?? 0) - (b.economy ?? 0),
      format: (t) => `${(t.economy ?? 0).toFixed(2)} (${overs(t.legalBallsBowled)} ov)`,
      note: (q) => `Min ${q.minBallsBowled / 6} overs bowled`,
    },
  },
  { no: 12, name: 'Dot Ball Specialist', basis: 'Most dot balls bowled', kind: 'stat', group: 'Bowling', rule: most('dotBalls') },
  { no: 13, name: 'Safe Hands', basis: 'Most catches', kind: 'stat', group: 'Fielding & All-round', rule: most('catches') },
  { no: 14, name: 'Runout Specialist', basis: 'Most run outs', kind: 'stat', group: 'Fielding & All-round', rule: most('runouts') },
  { no: 15, name: 'Best All-Rounder', basis: `Highest MVP points: ${MVP_RULE}`, kind: 'stat', group: 'Fielding & All-round', rule: most('mvp') },
  { no: 16, name: 'Most Sensible Player', basis: 'Organizer / peer nomination', kind: 'special', group: 'Special' },
  { no: 17, name: 'Emerging Player', basis: 'Organizer selection; define eligibility before season', kind: 'special', group: 'Special' },
  { no: 18, name: 'Entertainer of the Season', basis: 'Organizer / peer vote', kind: 'special', group: 'Special' },
  { no: 19, name: 'Best Sportsmanship', basis: 'Organizer / peer nomination', kind: 'special', group: 'Special' },
  { no: 20, name: 'Best Team Player', basis: 'Organizer / captain nomination', kind: 'special', group: 'Special' },
];

/** Top 3 with competition ranking: ties share a place (1, 2, 2 → next is 4th). */
export function podium(totals: PlayerTotals[], rule: StatRule, q: Qualification): AwardPlace[] {
  const list = totals
    .filter((t) => rule.eligible(t, q))
    .sort((a, b) => rule.cmp(a, b) || a.playerName.localeCompare(b.playerName));
  const places: AwardPlace[] = [];
  let rank = 0;
  list.forEach((t, i) => {
    if (i === 0 || rule.cmp(list[i - 1], t) !== 0) rank = i + 1;
    if (rank > 3) return;
    const last = places[places.length - 1];
    if (last && last.position === rank) last.players.push({ id: t.playerId, name: t.playerName });
    else places.push({ position: rank as 1 | 2 | 3, players: [{ id: t.playerId, name: t.playerName }], value: rule.format(t) });
  });
  return places;
}

export function computeAwards(totals: PlayerTotals[], q: Qualification): AwardResult[] {
  return AWARD_CATEGORIES.map(({ rule, ...category }) => ({
    category,
    places: rule ? podium(totals, rule, q) : [],
    note: rule?.note?.(q),
  }));
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export interface AwardsInput {
  matches: Match[];
  innings: Innings[];
  deliveries: Delivery[];
  roster: RosterPlayer[];
  season?: Season;
  /** Only this week; omit for the whole season (or all matches). */
  week?: number;
}

export function computeAwardsData({ matches, innings, deliveries, roster, season, week }: AwardsInput): AwardsData {
  const counted = matches.filter((m) => countsForStats(m, season?.id)).sort((a, b) => a.createdAt - b.createdAt);
  const scopeStart = scopeStartFor(matches, season);
  const weeksWithMatches = [...new Set(counted.map((m) => weekOf(m.createdAt, scopeStart)))].sort((a, b) => a - b);
  const scoped = week ? counted.filter((m) => weekOf(m.createdAt, scopeStart) === week) : counted;

  const rosterById = new Map(roster.map((p) => [p.id, p]));
  const inningsIdsByMatch = new Map<string, Set<string>>();
  for (const inn of innings) {
    inningsIdsByMatch.set(inn.matchId, (inningsIdsByMatch.get(inn.matchId) ?? new Set()).add(inn.id));
  }
  const delsByInnings = new Map<string, Delivery[]>();
  for (const d of deliveries) delsByInnings.set(d.inningsId, [...(delsByInnings.get(d.inningsId) ?? []), d]);

  const rows: MatchLogRow[] = [];
  for (const match of scoped) {
    const ids = inningsIdsByMatch.get(match.id) ?? new Set<string>();
    const dels = [...ids].flatMap((id) => delsByInnings.get(id) ?? []);
    const matchWeek = weekOf(match.createdAt, scopeStart);
    for (const team of match.teams) {
      for (const p of team.players) {
        const player = rosterById.get(p.id);
        if (player) rows.push(playerLine(match, team.name, player, dels, matchWeek));
      }
    }
  }

  const rowsByPlayer = new Map<string, MatchLogRow[]>();
  for (const r of rows) rowsByPlayer.set(r.playerId, [...(rowsByPlayer.get(r.playerId) ?? []), r]);
  const totals = roster.map((p) => totalsFor(p, rowsByPlayer.get(p.id) ?? []));

  const qualification = week ? WEEK_QUALIFICATION : SEASON_QUALIFICATION;
  return { rows, totals, awards: computeAwards(totals, qualification), matchCount: scoped.length, qualification, weeksWithMatches };
}

// ─── Sharing ─────────────────────────────────────────────────────────────────

const MEDALS = ['🥇', '🥈', '🥉'];

/** Plain-text winners list for WhatsApp. Special awards are left to organizers. */
export function buildAwardsShareText(title: string, subtitle: string, awards: AwardResult[]): string {
  const lines = [`🏆 *${title}*`, subtitle, ''];
  let group = '';
  for (const a of awards) {
    if (a.category.kind !== 'stat' || a.places.length === 0) continue;
    if (a.category.group !== group) {
      group = a.category.group;
      lines.push(`*${group}*`);
    }
    const podiumText = a.places
      .map((p) => `${MEDALS[p.position - 1]} ${p.players.map((x) => x.name).join(' & ')} (${p.value})`)
      .join('  ');
    lines.push(`${a.category.name}: ${podiumText}`);
  }
  lines.push('', '_Scored with CricScore_');
  return lines.join('\n');
}
