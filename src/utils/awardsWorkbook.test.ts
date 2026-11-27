import { describe, expect, it } from 'vitest';
import ExcelJS from 'exceljs';
import { buildAwardsWorkbook } from '@/utils/awardsWorkbook';
import { computeAwards, SEASON_QUALIFICATION } from '@/utils/awards';
import type { AwardsData, MatchLogRow, PlayerTotals } from '@/types/awards.types';

const totals = (id: string, name: string, runs: number, wickets: number): PlayerTotals => ({
  playerId: id, playerName: name, matches: 1, innings: 1, runs, ballsFaced: 20, fours: 2, sixes: 1,
  highScore: runs, notOuts: 0, dismissals: 1, wickets, maidens: 0, legalBallsBowled: 12, runsConceded: 15,
  bestWickets: wickets, bestRuns: 15, catches: 0, runouts: 0, stumpings: 0, dotBalls: 4, ducks: 0, extrasConceded: 1,
  battingAvg: runs, strikeRate: runs * 5, economy: 7.5, mvp: runs + 20 * wickets,
});

const row = (id: string, name: string, runs: number, wickets: number): MatchLogRow => ({
  week: 1, date: Date.UTC(2026, 11, 2), matchId: 'm1', matchName: 'Match 1', playerId: id, playerName: name,
  teamName: 'Team A', result: 'Team A won', batted: true, runs, ballsFaced: 20, fours: 2, sixes: 1, notOut: false,
  wickets, legalBallsBowled: 12, maidens: 0, runsConceded: 15, catches: 0, runouts: 0, stumpings: 0, dotBalls: 4,
  duck: false, extrasConceded: 1,
});

describe('buildAwardsWorkbook', () => {
  it('writes the tracker sheets with formulas, results and award winners', async () => {
    const t = [totals('a', 'Arun', 40, 1), totals('b', 'Babu', 25, 3)];
    const data: AwardsData = {
      rows: [row('a', 'Arun', 40, 1), row('b', 'Babu', 25, 3)],
      totals: t,
      awards: computeAwards(t, SEASON_QUALIFICATION),
      matchCount: 1,
      qualification: SEASON_QUALIFICATION,
      weeksWithMatches: [1],
    };
    const blob = await buildAwardsWorkbook({
      title: 'Season 1 Awards',
      scopeLabel: 'Season to date',
      data,
      weekByWeek: [{ week: 1, label: 'Week 1', awards: data.awards }],
    });

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await blob.arrayBuffer());
    expect(wb.worksheets.map((w) => w.name)).toEqual(['Start Here', 'Players', 'Match Log', 'Leaderboard', 'Awards', 'Week by Week']);

    const players = wb.getWorksheet('Players')!;
    expect(players.getRow(3).values).toEqual([undefined, 'Player Name', 'Matches']);

    const log = wb.getWorksheet('Match Log')!;
    expect(log.getCell('D4').value).toBe('Arun');
    expect(log.getCell('K4').value).toBe(2); // 12 balls = 2.00 overs

    const lb = wb.getWorksheet('Leaderboard')!;
    expect(lb.getCell('A4').value).toBe('Babu'); // ranked by MVP: 25 + 60 > 40 + 20
    const runs = lb.getCell('C4').value as { formula: string; result: number };
    expect(runs.formula).toContain("SUMIF('Match Log'!$D$4");
    expect(runs.result).toBe(25);

    const awards = wb.getWorksheet('Awards')!;
    expect(awards.getCell('B4').value).toBe('Run Machine');
    expect(awards.getCell('D4').value).toBe('Arun (40)');
    expect(awards.getCell('D11').value).toBe('Babu (3)');           // Wicket Hunter
    expect(awards.getCell('G19').value).toContain('Organizer pick'); // special award
  });
});
