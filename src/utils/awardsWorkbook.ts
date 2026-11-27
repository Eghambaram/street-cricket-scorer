/**
 * Builds the awards workbook (.xlsx) in the layout of the club's "Wacky Cricket
 * Awards" tracker: Start Here, Players, Match Log, Leaderboard (live formulas
 * over the Match Log, so organizers can still correct a row), Awards and Week
 * by Week. ExcelJS is loaded on demand so it never weighs on app start.
 */
import type { Workbook, Worksheet, Cell } from 'exceljs';
import type { AwardResult, AwardsData } from '@/types/awards.types';
import type { Season } from '@/types/season.types';
import { MVP_RULE } from '@/utils/awards';
import { formatSeasonRange } from '@/utils/season';

const NAVY = 'FF17365D';
const ROW_TINT = 'FFF3F6FA';
const LINE = 'FFD9E1F2';
const NOTE = 'FF666666';
const MEDAL_FILLS = ['FFFFF2CC', 'FFEDEDED', 'FFF8E1D0'];

export interface WeekAwards { week: number; label: string; awards: AwardResult[] }

export interface AwardsWorkbookInput {
  title: string;              // e.g. "Season 1 Awards"
  scopeLabel: string;         // "Season to date" | "Week 3 · 15–21 Dec"
  season?: Season;
  data: AwardsData;
  weekByWeek?: WeekAwards[];  // season exports only
}

const fill = (argb: string) => ({ type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb } });

function titleRow(ws: Worksheet, lastCol: string, text: string) {
  ws.mergeCells(`A1:${lastCol}1`);
  const c = ws.getCell('A1');
  c.value = text;
  c.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  c.fill = fill(NAVY);
  c.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
  ws.getRow(1).height = 30;
}

function headerRow(ws: Worksheet, rowNo: number, headers: string[]) {
  const row = ws.getRow(rowNo);
  headers.forEach((h, i) => {
    const c = row.getCell(i + 1);
    c.value = h;
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = fill(NAVY);
    c.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  row.height = 32;
}

function bodyStyle(ws: Worksheet, from: number, to: number, cols: number) {
  for (let r = from; r <= to; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= cols; c++) {
      const cell = row.getCell(c);
      cell.border = { bottom: { style: 'thin', color: { argb: LINE } } };
      if ((r - from) % 2 === 1) cell.fill = fill(ROW_TINT);
    }
  }
}

function widths(ws: Worksheet, w: number[]) {
  w.forEach((width, i) => { ws.getColumn(i + 1).width = width; });
}

const note = (cell: Cell, text: string) => {
  cell.value = text;
  cell.font = { italic: true, size: 9, color: { argb: NOTE } };
};

const placeText = (a: AwardResult, position: 1 | 2 | 3) => {
  const p = a.places.find((x) => x.position === position);
  if (!p) return '';
  const names = p.players.map((x) => x.name).join(' & ');
  return `${names} (${p.value})${p.players.length > 1 ? ' — shared' : ''}`;
};

// ─── Sheets ──────────────────────────────────────────────────────────────────

function startHere(wb: Workbook, { title, scopeLabel, season, data }: AwardsWorkbookInput) {
  const ws = wb.addWorksheet('Start Here');
  widths(ws, [22, 22, 22, 22, 22, 22]);
  titleRow(ws, 'F', `${title.toUpperCase()} | ${scopeLabel.toUpperCase()}`);
  const q = data.qualification;
  const players = data.totals.filter((t) => t.matches > 0).length;
  const lines: [string, string][] = [
    ['Season', season ? `${season.name} · ${formatSeasonRange(season)}` : 'All completed matches'],
    ['This export', `${scopeLabel} · ${data.matchCount} match${data.matchCount !== 1 ? 'es' : ''} · ${players} players · exported ${new Date().toLocaleString()}`],
    ['What counts', 'Completed matches marked for the season. Abandoned, unfinished and casual matches are left out. Guests (not on the club roster) are not included.'],
    ['How to use', '1) Check the Match Log against the scorecards. 2) Leaderboard totals recalculate from the Match Log if you correct a row. 3) Awards shows the app\'s top 3 — verify, then fill the 5 special awards.'],
    ['Overs', 'Overs Bowled are true decimals for calculations: 4 overs 2 balls = 4.33 (not 4.2).'],
    ['Qualification', `Batting average and strike rate: min ${q.minBallsFaced} balls faced (average also needs at least one dismissal). Economy: min ${q.minBallsBowled / 6} overs.`],
    ['Ties', 'Tied players share the place (e.g. two 2nd places, then no 3rd).'],
    ['MVP points', MVP_RULE],
    ['Fielding', 'Catches, run outs and stumpings count only when the scorer picked the fielder for the wicket.'],
    ['Award format', '15 statistical categories with top 3 (45 recognitions) + 5 special categories with one winner each = 50 recognitions.'],
  ];
  lines.forEach(([k, v], i) => {
    const r = i + 3;
    ws.mergeCells(`B${r}:F${r}`);
    const key = ws.getCell(`A${r}`);
    key.value = k;
    key.font = { bold: true, color: { argb: NAVY } };
    key.alignment = { vertical: 'top' };
    const val = ws.getCell(`B${r}`);
    val.value = v;
    val.alignment = { wrapText: true, vertical: 'top' };
    ws.getRow(r).height = v.length > 110 ? 46 : v.length > 55 ? 32 : 18;
  });
}

/** Club roster, A–Z. Its names feed the Match Log player dropdown. Returns the player count. */
function playersSheet(wb: Workbook, data: AwardsData): number {
  const ws = wb.addWorksheet('Players');
  widths(ws, [28, 12]);
  titleRow(ws, 'B', 'CLUB ROSTER');
  headerRow(ws, 3, ['Player Name', 'Matches']);
  const sorted = [...data.totals].sort((a, b) => a.playerName.localeCompare(b.playerName));
  sorted.forEach((t) => ws.addRow([t.playerName, t.matches]));
  bodyStyle(ws, 4, 3 + sorted.length, 2);
  ws.views = [{ state: 'frozen', ySplit: 3 }];
  if (sorted.length) ws.autoFilter = `A3:B${3 + sorted.length}`;
  return sorted.length;
}

/** Returns the last row that Leaderboard formulas should cover. */
function matchLog(wb: Workbook, data: AwardsData, playerCount: number): number {
  const ws = wb.addWorksheet('Match Log');
  widths(ws, [8, 13, 26, 22, 8, 10, 8, 8, 12, 9, 12, 9, 12, 9, 9, 11, 10, 8, 12, 36]);
  titleRow(ws, 'T', 'MATCH-BY-MATCH DATA | ONE ROW PER PLAYER PER MATCH');
  ws.mergeCells('K2:T2');
  note(ws.getCell('K2'), '*Overs Bowled are true decimals: 4 overs 2 balls = 4.33. Not Out? is blank when the player did not bat.');
  headerRow(ws, 3, [
    'Week', 'Match Date', 'Match ID', 'Player Name', 'Runs', 'Balls Faced', 'Fours', 'Sixes', 'Not Out? (Y/N)',
    'Wickets', 'Overs Bowled*', 'Maidens', 'Runs Conceded', 'Catches', 'Runouts', 'Stumpings', 'Dot Balls', 'Ducks',
    'Extras Conceded', 'Notes',
  ]);
  const rows = [...data.rows].sort((a, b) => a.date - b.date || a.teamName.localeCompare(b.teamName) || a.playerName.localeCompare(b.playerName));
  rows.forEach((r) => {
    const row = ws.addRow([
      r.week, new Date(r.date), r.matchName, r.playerName, r.runs, r.ballsFaced, r.fours, r.sixes,
      r.batted ? (r.notOut ? 'Y' : 'N') : '', r.wickets,
      r.legalBallsBowled ? Math.round((r.legalBallsBowled / 6) * 100) / 100 : 0,
      r.maidens, r.runsConceded, r.catches, r.runouts, r.stumpings, r.dotBalls, r.duck ? 1 : 0, r.extrasConceded,
      [r.teamName, r.result, r.batted ? '' : 'DNB'].filter(Boolean).join(' · '),
    ]);
    row.getCell(2).numFmt = 'dd mmm yyyy';
    row.getCell(11).numFmt = '0.00';
  });
  const last = 3 + rows.length;
  bodyStyle(ws, 4, last, 20);
  // Room for organizers to add rows; formulas cover it too
  const formulaLast = Math.max(last + 200, 603);
  for (let r = 4; r <= formulaLast; r++) {
    ws.getCell(`D${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: [`Players!$A$4:$A$${3 + playerCount}`] };
    ws.getCell(`I${r}`).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Y,N"'] };
  }
  ws.views = [{ state: 'frozen', ySplit: 3, xSplit: 4 }];
  if (rows.length) ws.autoFilter = `A3:T${last}`;
  return formulaLast;
}

function leaderboard(wb: Workbook, data: AwardsData, logLast: number) {
  const ws = wb.addWorksheet('Leaderboard');
  widths(ws, [22, 10, 9, 11, 8, 8, 12, 10, 10, 10, 12, 13, 14, 10, 10, 11, 10, 8, 13, 12, 12, 12, 12]);
  titleRow(ws, 'W', 'LEADERBOARD | AUTO-CALCULATED FROM MATCH LOG');
  headerRow(ws, 3, [
    'Player Name', 'Matches', 'Runs', 'Balls Faced', 'Fours', 'Sixes', 'Highest Score', 'Not Outs', 'Wickets',
    'Maidens', 'Overs Bowled', 'Runs Conceded', 'Best Wkts/Match', 'Catches', 'Runouts', 'Stumpings', 'Dot Balls',
    'Ducks', 'Extras Conceded', 'Batting Avg', 'Strike Rate', 'Bowling Econ', 'MVP Points',
  ]);
  const rng = (col: string) => `'Match Log'!$${col}$4:$${col}$${logLast}`;
  const names = rng('D');
  const sumif = (col: string, r: number) => `SUMIF(${names},$A${r},${rng(col)})`;
  // Ranked by MVP points; names are values (not links) so sorting the sheet is safe
  const sorted = [...data.totals].sort((a, b) => b.mvp - a.mvp || b.runs - a.runs || a.playerName.localeCompare(b.playerName));
  sorted.forEach((t, i) => {
    const r = i + 4;
    const overs = Math.round((t.legalBallsBowled / 6) * 100) / 100;
    const f = (formula: string, result: number) => ({ formula, result });
    ws.getRow(r).values = [
      t.playerName,
      f(`COUNTIF(${names},$A${r})`, t.matches),
      f(sumif('E', r), t.runs),
      f(sumif('F', r), t.ballsFaced),
      f(sumif('G', r), t.fours),
      f(sumif('H', r), t.sixes),
      f(`IFERROR(MAXIFS(${rng('E')},${names},$A${r}),0)`, t.highScore),
      f(`COUNTIFS(${names},$A${r},${rng('I')},"Y")`, t.notOuts),
      f(sumif('J', r), t.wickets),
      f(sumif('L', r), t.maidens),
      f(sumif('K', r), overs),
      f(sumif('M', r), t.runsConceded),
      f(`IFERROR(MAXIFS(${rng('J')},${names},$A${r}),0)`, t.bestWickets),
      f(sumif('N', r), t.catches),
      f(sumif('O', r), t.runouts),
      f(sumif('P', r), t.stumpings),
      f(sumif('Q', r), t.dotBalls),
      f(sumif('R', r), t.ducks),
      f(sumif('S', r), t.extrasConceded),
      f(`IFERROR(C${r}/COUNTIFS(${names},$A${r},${rng('I')},"N"),0)`, t.battingAvg ?? 0),
      f(`IFERROR(C${r}/D${r}*100,0)`, t.strikeRate ?? 0),
      f(`IFERROR(L${r}/K${r},0)`, t.economy ?? 0),
      f(`C${r}+I${r}*20+N${r}*10+O${r}*10+P${r}*10`, t.mvp),
    ];
    ['K', 'T', 'U', 'V'].forEach((col) => { ws.getCell(`${col}${r}`).numFmt = '0.00'; });
  });
  const last = 3 + sorted.length;
  bodyStyle(ws, 4, last, 23);
  if (sorted.length) {
    ws.addConditionalFormatting({
      ref: `C4:C${last}`,
      rules: [{
        type: 'colorScale', priority: 1,
        cfvo: [{ type: 'min' }, { type: 'percentile', value: 50 }, { type: 'max' }],
        color: [{ argb: 'FFF8696B' }, { argb: 'FFFFEB84' }, { argb: 'FF63BE7B' }],
      }],
    });
    ws.autoFilter = `A3:W${last}`;
  }
  ws.views = [{ state: 'frozen', ySplit: 3, xSplit: 1 }];
}

function awardsSheet(wb: Workbook, { data, scopeLabel }: AwardsWorkbookInput) {
  const ws = wb.addWorksheet('Awards');
  widths(ws, [6, 26, 46, 28, 28, 28, 30]);
  titleRow(ws, 'G', `AWARDS | ${scopeLabel.toUpperCase()} | VERIFY BEFORE PUBLISHING`);
  headerRow(ws, 3, ['No.', 'Award Category', 'Metric / Selection Basis', '1st Place', '2nd Place', '3rd Place', 'Verified by / Notes']);
  [4, 5, 6].forEach((c, i) => { ws.getRow(3).getCell(c).fill = fill(['FFBF9000', 'FF7F7F7F', 'FF9C5B2E'][i]); });
  data.awards.forEach((a, i) => {
    const r = i + 4;
    const special = a.category.kind === 'special';
    ws.getRow(r).values = [
      a.category.no, a.category.name, a.category.basis,
      special ? '' : placeText(a, 1) || 'No qualifier yet',
      special ? '' : placeText(a, 2),
      special ? '' : placeText(a, 3),
      special ? 'Organizer pick — one winner' : a.note ?? '',
    ];
    const row = ws.getRow(r);
    row.alignment = { vertical: 'middle', wrapText: true };
    row.getCell(2).font = { bold: true };
    if (!special) [4, 5, 6].forEach((c, k) => { if (row.getCell(c).value) row.getCell(c).fill = fill(MEDAL_FILLS[k]); });
    row.getCell(7).font = { italic: true, size: 9, color: { argb: NOTE } };
    row.height = 30;
  });
  bodyStyle(ws, 4, 3 + data.awards.length, 3);
  ws.views = [{ state: 'frozen', ySplit: 3 }];
}

function weekByWeek(wb: Workbook, weeks: WeekAwards[]) {
  if (weeks.length === 0) return;
  const ws = wb.addWorksheet('Week by Week');
  widths(ws, [26, ...weeks.map(() => 26)]);
  titleRow(ws, ws.getColumn(weeks.length + 1).letter, 'WEEKLY WINNERS | 1ST PLACE PER CATEGORY');
  headerRow(ws, 3, ['Award', ...weeks.map((w) => w.label)]);
  const stat = weeks[0].awards.filter((a) => a.category.kind === 'stat');
  stat.forEach((a, i) => {
    ws.getRow(i + 4).values = [
      a.category.name,
      ...weeks.map((w) => placeText(w.awards.find((x) => x.category.no === a.category.no)!, 1) || '—'),
    ];
    ws.getRow(i + 4).alignment = { vertical: 'middle', wrapText: true };
    ws.getRow(i + 4).getCell(1).font = { bold: true };
  });
  bodyStyle(ws, 4, 3 + stat.length, weeks.length + 1);
  ws.views = [{ state: 'frozen', ySplit: 3, xSplit: 1 }];
}

export async function buildAwardsWorkbook(input: AwardsWorkbookInput): Promise<Blob> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'CricScore';
  wb.created = new Date();
  wb.calcProperties = { fullCalcOnLoad: true };

  startHere(wb, input);
  const playerCount = playersSheet(wb, input.data);
  const logLast = matchLog(wb, input.data, playerCount);
  leaderboard(wb, input.data, logLast);
  awardsSheet(wb, input);
  weekByWeek(wb, input.weekByWeek ?? []);

  const buffer = await wb.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
