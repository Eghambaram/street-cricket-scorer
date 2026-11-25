import type { Match } from '@/types/match.types';
import type { Season } from '@/types/season.types';

const DAY_MS = 86_400_000;

/** Minimum innings before an average / economy is ranked or shown. */
export const MIN_QUALIFYING_INNINGS = 3;

export function startOfDay(ms: number): number {
  const d = new Date(ms);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function endOfDay(ms: number): number {
  return startOfDay(ms) + DAY_MS - 1;
}

/** Default season: today until the same day 3 months later. */
export function defaultSeasonRange(now = Date.now()): { startAt: number; endAt: number } {
  const end = new Date(now);
  end.setMonth(end.getMonth() + 3);
  end.setDate(end.getDate() - 1);
  return { startAt: startOfDay(now), endAt: endOfDay(end.getTime()) };
}

/** The season running today, if any. Latest start wins if seasons overlap. */
export function getActiveSeason(seasons: Season[], now = Date.now()): Season | undefined {
  return [...seasons]
    .sort((a, b) => b.startAt - a.startAt)
    .find((s) => s.startAt <= now && now <= s.endAt);
}

export function formatSeasonRange(season: Pick<Season, 'startAt' | 'endAt'>): string {
  const fmt = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  return `${fmt(season.startAt)} – ${fmt(season.endAt)}`;
}

/** yyyy-mm-dd for <input type="date">, in local time. */
export function toDateInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function fromDateInput(value: string): number {
  const [y, m, d] = value.split('-').map(Number);
  return new Date(y, m - 1, d).getTime();
}

export function isAbandoned(match: Match): boolean {
  return match.result?.resultText === 'Match Abandoned';
}

/**
 * The single rule for stats: a match counts when it is completed, not abandoned,
 * and (when a season is given) tagged with that season.
 */
export function countsForStats(match: Match, seasonId?: string): boolean {
  if (match.status !== 'completed' || isAbandoned(match)) return false;
  return seasonId === undefined || match.seasonId === seasonId;
}
