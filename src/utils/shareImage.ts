import type { Match, Innings } from '@/types/match.types';
import type { InningsStats } from '@/types/delivery.types';
import { formatScore, formatOversShort } from './format';
import { computeRunRate } from './cricket';
import { bowlerOversDisplay } from './cricket';

// ─── Colour tokens ───────────────────────────────────────────────────────────
// The exported image is independent of the app theme: it defaults to LIGHT
// (white background, dark text) so it reads well when shared/printed.
const DARK = {
  bg:          '#0C0F0A',
  surface:     '#141810',
  surfaceAlt:  '#1A1F16',
  border:      '#2a3226',
  borderFaint: '#1f2a1d',
  fg:          '#E8F0E2',
  muted:       '#8FA883',
  mutedDim:    '#6B7D63',
  gold:        '#FFB800',
  goldDim:     '#C48A00',
  goldTint:    'rgba(255,184,0,0.12)',
  brand:       '#2FA35A',
  runs:        '#6FCF4A',
  wicket:      '#E84C6A',
  four:        '#3BC9DB',
  six:         '#E84C6A',
  wide:        '#A78BFA',
  noball:      '#FB923C',
  amber:       '#F5A623',
};

type Palette = typeof DARK;
type ShareImageTheme = 'light' | 'dark';

const LIGHT: Palette = {
  bg:          '#FFFFFF',
  surface:     '#F7F9F5',
  surfaceAlt:  '#EEF3EA',
  border:      '#D9E1D3',
  borderFaint: '#E8EDE4',
  fg:          '#14200F',
  muted:       '#4A5C42',
  mutedDim:    '#6F7F67',
  gold:        '#9A6B00',
  goldDim:     '#7F5900',
  goldTint:    'rgba(201,146,0,0.10)',
  brand:       '#1F7A3A',
  runs:        '#2B7A1C',
  wicket:      '#C2223F',
  four:        '#08788A',
  six:         '#C2223F',
  wide:        '#6741D9',
  noball:      '#C2570C',
  amber:       '#B25E00',
};

// Active palette for the current render. Drawing is fully synchronous inside
// buildShareImage, so swapping it per call is safe.
let C: Palette = LIGHT;

// ─── Layout constants (logical px; the PNG is rendered at SCALE× for sharpness) ─
//
// A shared image is usually viewed full-width on a phone (~390pt), i.e. at about
// half of its 720px logical width — so body text is 20px+ to stay readable.
const W        = 720;
const PAGE_X   = 24;               // page side margin
const CARD_W   = W - PAGE_X * 2;   // 672
const CARD_PAD = 24;
const INNER_X  = PAGE_X + CARD_PAD;
const INNER_R  = PAGE_X + CARD_W - CARD_PAD;
const INNER_W  = INNER_R - INNER_X; // 624
const SCALE    = 2;
const MAX_CANVAS_PIXELS = 16_000_000; // stay under iOS Safari's canvas area limit

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

// ─── Drawing helpers ─────────────────────────────────────────────────────────

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function setFont(ctx: CanvasRenderingContext2D, size: number, weight: string, tracking = 0) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  // letterSpacing is not in every browser; harmless where unsupported
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string };
  if ('letterSpacing' in c) c.letterSpacing = `${tracking}px`;
}

/** Trim text with an ellipsis so it fits maxWidth (never squashes glyphs). */
function ellipsize(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > maxWidth) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

interface TextOpts {
  size?: number; weight?: string; color?: string;
  align?: CanvasTextAlign; maxWidth?: number; tracking?: number;
}

function drawText(ctx: CanvasRenderingContext2D, value: string, x: number, y: number, opts: TextOpts = {}) {
  const { size = 20, weight = '500', color = C.fg, align = 'left', maxWidth, tracking = 0 } = opts;
  setFont(ctx, size, weight, tracking);
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(maxWidth ? ellipsize(ctx, value, maxWidth) : value, x, y);
}

/** Word-wrap `parts` (joined by sep) into lines that fit maxWidth. */
function wrapParts(ctx: CanvasRenderingContext2D, parts: string[], sep: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const part of parts) {
    const candidate = line ? `${line}${sep}${part}` : part;
    if (line && ctx.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = part;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines.map((l) => ellipsize(ctx, l, maxWidth));
}

function hline(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color = C.borderFaint) {
  ctx.fillStyle = color;
  ctx.fillRect(x, Math.round(y), w, 1);
}

function card(ctx: CanvasRenderingContext2D, y: number, h: number) {
  ctx.fillStyle = C.surface;
  roundRect(ctx, PAGE_X, y, CARD_W, h, 20);
  ctx.fill();
  ctx.strokeStyle = C.border;
  ctx.lineWidth = 1;
  roundRect(ctx, PAGE_X + 0.5, y + 0.5, CARD_W - 1, h - 1, 20);
  ctx.stroke();
}

function sectionLabel(ctx: CanvasRenderingContext2D, label: string, y: number) {
  drawText(ctx, label, INNER_X, y, { size: 14, weight: '800', color: C.brand, tracking: 1.5 });
}

// ─── Innings card ────────────────────────────────────────────────────────────
//
// All stat columns are right-anchored; the name column takes what's left.
//   Batting:  R 60 | B 56 | 4s 48 | 6s 48 | SR 68   → names get ~330px
//   Bowling:  O 60 | M 48 | R 56  | W 52  | Econ 72 → names get ~320px

function drawInningsContent(
  ctx: CanvasRenderingContext2D,
  match: Match,
  innings: Innings,
  stats: InningsStats,
  startY: number,
): number {
  let y = startY + CARD_PAD;

  const batSR = INNER_R;
  const bat6s = batSR - 68;
  const bat4s = bat6s - 48;
  const batB  = bat4s - 48;
  const batR  = batB  - 56;
  const nameMaxW = batR - 60 - INNER_X;

  const bowlEcon = INNER_R;
  const bowlW    = bowlEcon - 72;
  const bowlR    = bowlW    - 52;
  const bowlM    = bowlR    - 56;
  const bowlO    = bowlM    - 48;
  const bowlerNameMaxW = bowlO - 60 - INNER_X;

  const battingTeam = match.teams.find((t) => t.id === innings.battingTeamId);
  const bowlingTeam = match.teams.find((t) => t.id === innings.bowlingTeamId);
  const playerName  = (id: string) => battingTeam?.players.find((p) => p.id === id)?.name ?? 'Player';
  const bowlerName  = (id: string) => bowlingTeam?.players.find((p) => p.id === id)?.name ?? 'Bowler';
  const rr          = computeRunRate(stats.totalRuns, stats.legalBalls);

  // ── Header: team + innings label | big score + overs/RR ──
  drawText(ctx, `${innings.inningsNumber === 1 ? '1ST' : '2ND'} INNINGS`, INNER_X, y + 14,
    { size: 13, weight: '800', color: C.mutedDim, tracking: 1.5 });
  drawText(ctx, formatScore(stats.totalRuns, stats.wickets), INNER_R, y + 40,
    { size: 44, weight: '900', color: C.fg, align: 'right' });
  setFont(ctx, 44, '900');
  const scoreW = ctx.measureText(formatScore(stats.totalRuns, stats.wickets)).width;
  drawText(ctx, battingTeam?.name ?? '?', INNER_X, y + 44,
    { size: 26, weight: '800', color: C.fg, maxWidth: INNER_W - scoreW - 24 });
  y += 58;
  drawText(ctx, `${formatOversShort(stats.legalBalls)} overs  ·  Run rate ${rr.toFixed(2)}`, INNER_R, y + 8,
    { size: 16, weight: '600', color: C.muted, align: 'right' });
  y += 26;
  hline(ctx, INNER_X, y, INNER_W, C.border);
  y += 30;

  // ── Batting ──
  sectionLabel(ctx, 'BATTING', y);
  const colHead = { size: 15, weight: '700', color: C.mutedDim, align: 'right' as const };
  drawText(ctx, 'R',  batR,  y, colHead);
  drawText(ctx, 'B',  batB,  y, colHead);
  drawText(ctx, '4s', bat4s, y, colHead);
  drawText(ctx, '6s', bat6s, y, colHead);
  drawText(ctx, 'SR', batSR, y, colHead);
  y += 14;

  const orderedBatsmen = innings.battingOrder
    .map((id) => stats.batsmanScores[id])
    .filter(Boolean);

  orderedBatsmen.forEach((bs) => {
    hline(ctx, INNER_X, y, INNER_W);
    const rowH = 66;
    const notOut = !bs.isOut;
    drawText(ctx, playerName(bs.playerId), INNER_X, y + 30, {
      size: 22, weight: notOut ? '800' : '600', color: C.fg, maxWidth: nameMaxW,
    });
    if (bs.isOut && bs.dismissalText) {
      drawText(ctx, bs.dismissalText, INNER_X, y + 54, { size: 16, weight: '500', color: C.muted, maxWidth: nameMaxW });
    } else if (notOut) {
      drawText(ctx, 'not out', INNER_X, y + 54, { size: 16, weight: '700', color: C.runs });
    }
    const runsColor = bs.runs >= 50 ? C.gold : C.fg;
    drawText(ctx, `${bs.runs}${notOut ? '*' : ''}`, batR, y + 41, { size: 26, weight: '800', color: runsColor, align: 'right' });
    drawText(ctx, String(bs.balls), batB, y + 41, { size: 20, weight: '500', color: C.muted, align: 'right' });
    drawText(ctx, String(bs.fours), bat4s, y + 41, {
      size: 20, weight: bs.fours > 0 ? '700' : '500', color: bs.fours > 0 ? C.four : C.mutedDim, align: 'right',
    });
    drawText(ctx, String(bs.sixes), bat6s, y + 41, {
      size: 20, weight: bs.sixes > 0 ? '700' : '500', color: bs.sixes > 0 ? C.six : C.mutedDim, align: 'right',
    });
    drawText(ctx, bs.balls > 0 ? bs.strikeRate.toFixed(0) : '—', batSR, y + 41, {
      size: 18, weight: '500', color: bs.balls > 0 && bs.strikeRate >= 150 ? C.gold : C.muted, align: 'right',
    });
    y += rowH;
  });

  // ── Extras + Total ──
  hline(ctx, INNER_X, y, INNER_W);
  drawText(ctx, 'Extras', INNER_X, y + 34, { size: 20, weight: '600', color: C.fg });
  drawText(
    ctx,
    `wd ${stats.extras.wides}, nb ${stats.extras.noBalls}, b ${stats.extras.byes}, lb ${stats.extras.legByes}`,
    INNER_X + 82, y + 34, { size: 16, weight: '500', color: C.muted, maxWidth: batR - 70 - (INNER_X + 82) },
  );
  drawText(ctx, String(stats.extrasTotal), batR, y + 34, { size: 20, weight: '700', color: C.fg, align: 'right' });
  y += 52;

  ctx.fillStyle = C.surfaceAlt;
  roundRect(ctx, INNER_X - 12, y, INNER_W + 24, 52, 12);
  ctx.fill();
  drawText(ctx, 'Total', INNER_X, y + 34, { size: 22, weight: '800', color: C.fg });
  drawText(ctx, `${formatScore(stats.totalRuns, stats.wickets)}  (${formatOversShort(stats.legalBalls)} ov)`,
    INNER_R, y + 34, { size: 22, weight: '800', color: C.fg, align: 'right' });
  y += 52;

  // ── Yet to bat ──
  const usedIds  = new Set(innings.battingOrder);
  const yetToBat = (battingTeam?.players ?? []).filter((p) => !usedIds.has(p.id));
  if (yetToBat.length > 0) {
    y += 30;
    drawText(ctx, 'YET TO BAT', INNER_X, y, { size: 13, weight: '800', color: C.mutedDim, tracking: 1.5 });
    setFont(ctx, 18, '500');
    const lines = wrapParts(ctx, yetToBat.map((p) => p.name), '  ·  ', INNER_W);
    lines.forEach((line) => {
      y += 28;
      drawText(ctx, line, INNER_X, y, { size: 18, weight: '500', color: C.muted });
    });
  }

  // ── Bowling ──
  const bowlers = Object.values(stats.bowlerScores)
    .filter((b) => b.legalBalls > 0)
    .sort((a, bb) => {
      const ai = bowlingTeam?.players.findIndex((p) => p.id === a.playerId) ?? 0;
      const bi = bowlingTeam?.players.findIndex((p) => p.id === bb.playerId) ?? 0;
      return ai - bi;
    });

  if (bowlers.length > 0) {
    y += 48;
    sectionLabel(ctx, 'BOWLING', y);
    drawText(ctx, 'O',    bowlO,    y, colHead);
    drawText(ctx, 'M',    bowlM,    y, colHead);
    drawText(ctx, 'R',    bowlR,    y, colHead);
    drawText(ctx, 'W',    bowlW,    y, colHead);
    drawText(ctx, 'Econ', bowlEcon, y, colHead);
    y += 14;

    bowlers.forEach((bwl) => {
      hline(ctx, INNER_X, y, INNER_W);
      const rowH = 54;
      drawText(ctx, bowlerName(bwl.playerId), INNER_X, y + 35, {
        size: 22, weight: '600', color: C.fg, maxWidth: bowlerNameMaxW,
      });
      drawText(ctx, bowlerOversDisplay(bwl.legalBalls), bowlO, y + 35, { size: 20, weight: '500', color: C.fg,    align: 'right' });
      drawText(ctx, String(bwl.maidens),                 bowlM, y + 35, { size: 20, weight: '500', color: C.muted, align: 'right' });
      drawText(ctx, String(bwl.runs),                    bowlR, y + 35, { size: 20, weight: '500', color: C.muted, align: 'right' });
      drawText(ctx, String(bwl.wickets), bowlW, y + 36, {
        size: 24, weight: '800', color: bwl.wickets > 0 ? C.wicket : C.mutedDim, align: 'right',
      });
      const econColor = bwl.economy <= 6 ? C.runs : bwl.economy <= 9 ? C.amber : C.wicket;
      drawText(ctx, bwl.economy.toFixed(1), bowlEcon, y + 35, { size: 18, weight: '600', color: econColor, align: 'right' });
      y += rowH;
    });
  }

  return y + CARD_PAD;
}

/** Draws one innings inside its own card; returns the y just below the card. */
function drawInnings(
  ctx: CanvasRenderingContext2D,
  measureCtx: CanvasRenderingContext2D,
  match: Match,
  innings: Innings,
  stats: InningsStats,
  startY: number,
): number {
  // Measure first so the card background is exactly as tall as its content
  const endY = drawInningsContent(measureCtx, match, innings, stats, startY);
  card(ctx, startY, endY - startY);
  drawInningsContent(ctx, match, innings, stats, startY);
  return endY;
}

// ─── Page ────────────────────────────────────────────────────────────────────

function drawPage(
  ctx: CanvasRenderingContext2D,
  measureCtx: CanvasRenderingContext2D,
  match: Match,
  innings1: Innings,
  inn1Stats: InningsStats,
  innings2: Innings | null,
  inn2Stats: InningsStats | null,
): number {
  // Background
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, 100_000);

  // Brand accent bar
  const bar = ctx.createLinearGradient(0, 0, W, 0);
  bar.addColorStop(0, C.brand);
  bar.addColorStop(1, C.gold);
  ctx.fillStyle = bar;
  ctx.fillRect(0, 0, W, 8);

  let y = 8 + 44;

  // ── Header ──
  drawText(ctx, 'CRICSCORE  ·  SCORECARD', W / 2, y, { size: 14, weight: '800', color: C.brand, align: 'center', tracking: 2 });
  y += 42;
  drawText(ctx, match.name, W / 2, y, { size: 32, weight: '900', color: C.fg, align: 'center', maxWidth: CARD_W });
  y += 30;
  drawText(
    ctx,
    `${new Date(match.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}  ·  ${match.config.overs} overs`,
    W / 2, y, { size: 17, weight: '500', color: C.muted, align: 'center' },
  );
  y += 32;

  // ── At-a-glance summary: one line per innings ──
  const summary: { innings: Innings; stats: InningsStats }[] = [{ innings: innings1, stats: inn1Stats }];
  if (innings2 && inn2Stats) summary.push({ innings: innings2, stats: inn2Stats });

  const hasResult = !!match.result?.resultText;
  setFont(ctx, 20, '800');
  const resultLines = hasResult ? wrapParts(ctx, match.result!.resultText.split(' '), ' ', INNER_W) : [];
  const summaryH = CARD_PAD + summary.length * 52 + (hasResult ? 20 + resultLines.length * 30 + 20 : 0) + CARD_PAD - 8;
  card(ctx, y, summaryH);
  let sy = y + CARD_PAD;
  summary.forEach(({ innings, stats }, i) => {
    const team = match.teams.find((t) => t.id === innings.battingTeamId);
    const winner = match.result?.winnerId === innings.battingTeamId;
    if (i > 0) hline(ctx, INNER_X, sy, INNER_W);
    const scoreText = formatScore(stats.totalRuns, stats.wickets);
    const oversText = `${formatOversShort(stats.legalBalls)} ov`;
    setFont(ctx, 30, '900');
    const scoreW = ctx.measureText(scoreText).width;
    drawText(ctx, oversText, INNER_R, sy + 36, { size: 17, weight: '500', color: C.muted, align: 'right' });
    setFont(ctx, 17, '500');
    const oversW = ctx.measureText(oversText).width;
    drawText(ctx, scoreText, INNER_R - oversW - 14, sy + 37, { size: 30, weight: '900', color: C.fg, align: 'right' });
    drawText(ctx, team?.name ?? '?', INNER_X, sy + 35, {
      size: 22, weight: winner ? '800' : '600', color: C.fg, maxWidth: INNER_W - scoreW - oversW - 40,
    });
    sy += 52;
  });
  if (hasResult) {
    sy += 12;
    const pillH = resultLines.length * 30 + 20;
    ctx.fillStyle = match.result!.winnerId ? C.goldTint : C.surfaceAlt;
    roundRect(ctx, INNER_X - 8, sy, INNER_W + 16, pillH, 12);
    ctx.fill();
    resultLines.forEach((line, i) => {
      drawText(ctx, line, W / 2, sy + 31 + i * 30, {
        size: 20, weight: '800', color: match.result!.winnerId ? C.gold : C.muted, align: 'center',
      });
    });
  }
  y += summaryH + 24;

  // ── Innings cards ──
  y = drawInnings(ctx, measureCtx, match, innings1, inn1Stats, y);
  if (innings2 && inn2Stats) {
    y += 24;
    y = drawInnings(ctx, measureCtx, match, innings2, inn2Stats, y);
  }

  // ── Footer ──
  y += 40;
  drawText(ctx, 'Scored with CricScore', W / 2, y, { size: 15, weight: '600', color: C.mutedDim, align: 'center' });
  return y + 32;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function buildShareImage(
  match: Match,
  innings1: Innings,
  inn1Stats: InningsStats,
  innings2: Innings | null,
  inn2Stats: InningsStats | null,
  theme: ShareImageTheme = 'light',
): Promise<Blob | null> {
  C = theme === 'dark' ? DARK : LIGHT;
  try {
    // Pass 1 — measure on a scratch canvas so the image is exactly content-height
    const scratch = document.createElement('canvas');
    scratch.width = 1;
    scratch.height = 1;
    const measureCtx = scratch.getContext('2d');
    if (!measureCtx) return null;
    const height = Math.ceil(drawPage(measureCtx, measureCtx, match, innings1, inn1Stats, innings2, inn2Stats));

    // Pass 2 — real render at SCALE× (falls back to 1× for very long cards)
    const scale = W * SCALE * height * SCALE <= MAX_CANVAS_PIXELS ? SCALE : 1;
    const canvas = document.createElement('canvas');
    canvas.width  = W * scale;
    canvas.height = height * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.scale(scale, scale);
    drawPage(ctx, measureCtx, match, innings1, inn1Stats, innings2, inn2Stats);

    return await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((blob) => resolve(blob), 'image/png', 1.0);
    });
  } catch {
    return null;
  }
}

export async function shareImageOrFallback(
  imageBlob: Blob,
  fallbackText: string,
  fileName = 'cricket-scorecard.png',
): Promise<'shared' | 'copied' | 'failed'> {
  // Try native share sheet with PNG file (mobile Chrome, Safari)
  if (navigator.share && navigator.canShare) {
    try {
      const file = new File([imageBlob], fileName, { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: 'Cricket Scorecard' });
        return 'shared';
      }
    } catch {
      // user cancelled or browser doesn't support file share
    }
  }
  // Desktop: download PNG
  try {
    const url = URL.createObjectURL(imageBlob);
    const a   = document.createElement('a');
    a.href     = url;
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    return 'shared';
  } catch {
    // Last resort: copy text
    if (navigator.clipboard) {
      try { await navigator.clipboard.writeText(fallbackText); return 'copied'; } catch { /* ignore */ }
    }
    return 'failed';
  }
}
