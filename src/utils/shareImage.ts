import type { Match, Innings } from '@/types/match.types';
import type { InningsStats } from '@/types/delivery.types';
import { formatScore, formatOversShort } from './format';
import { computeRunRate } from './cricket';
import { bowlerOversDisplay } from './cricket';

// ─── Colour tokens — premium dark scorecard palette ──────────────────────────
const C = {
  bg:          '#0C0F0A',
  surface:     '#141810',
  surfaceAlt:  '#1A1F16',
  border:      '#2a3226',
  borderFaint: '#1f2a1d',
  fg:          '#E8F0E2',
  muted:       '#8FA883',
  mutedDim:    '#4D5E47',
  gold:        '#FFB800',
  goldDim:     '#C48A00',
  runs:        '#6FCF4A',
  wicket:      '#E84C6A',
  four:        '#3BC9DB',
  six:         '#E84C6A',
  wide:        '#A78BFA',
  noball:      '#FB923C',
  amber:       '#F5A623',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function fillRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
  color: string,
) {
  ctx.fillStyle = color;
  roundRect(ctx, x, y, w, h, r);
  ctx.fill();
}

function drawText(
  ctx: CanvasRenderingContext2D,
  value: string,
  x: number, y: number,
  opts: {
    size?: number; weight?: string; color?: string;
    align?: CanvasTextAlign; maxWidth?: number;
  } = {},
) {
  const { size = 14, weight = '600', color = C.fg, align = 'left', maxWidth } = opts;
  ctx.font = `${weight} ${size}px system-ui, -apple-system, sans-serif`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  if (maxWidth && maxWidth > 0) ctx.fillText(value, x, y, maxWidth);
  else if (!maxWidth) ctx.fillText(value, x, y);
}

function hline(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color = C.border) {
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
}

function gradientLine(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, color: string) {
  const g = ctx.createLinearGradient(x, y, x + w, y);
  g.addColorStop(0,   color + '00');
  g.addColorStop(0.25, color);
  g.addColorStop(0.75, color);
  g.addColorStop(1,   color + '00');
  ctx.strokeStyle = g;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
}

// ─── Innings block renderer ───────────────────────────────────────────────────
//
// Column layout — ALL stat cols anchored from the RIGHT edge of the card.
// Name column fills the remaining space on the left.
//
// Card right edge = marginX + cardW  (e.g. 32 + 656 = 688)
//
// BATTING (right → left):
//   SR   ← right edge            width ~50
//   6s   ← SR - 50               width ~36
//   4s   ← 6s - 36               width ~36
//   B    ← 4s - 36               width ~38
//   R    ← B  - 38               width ~42 (larger font)
//   Name ← left margin, maxW = R - marginX - 16
//
// BOWLING (right → left):
//   Econ ← right edge            width ~52
//   W    ← Econ - 52             width ~30
//   R    ← W - 30                width ~30
//   M    ← R - 30                width ~30
//   O    ← M - 30                width ~36
//   Name ← left margin, maxW = O - marginX - 12

function drawInnings(
  ctx: CanvasRenderingContext2D,
  match: Match,
  innings: Innings,
  stats: InningsStats,
  startY: number,
  cardW: number,
  marginX: number,
): number {
  let y = startY;
  const cardRight = marginX + cardW;

  // ── Batting column positions (right-anchored) ──
  const batSR    = cardRight;
  const bat6s    = batSR   - 50;
  const bat4s    = bat6s   - 36;
  const batB     = bat4s   - 36;
  const batR     = batB    - 38;
  const nameMaxW = batR    - marginX - 16;   // always positive: 524 - 32 - 16 = 476

  // ── Bowling column positions (right-anchored) ──
  const bowlEcon = cardRight;
  const bowlW    = bowlEcon - 52;
  const bowlR    = bowlW    - 30;
  const bowlM    = bowlR    - 30;
  const bowlO    = bowlM    - 30;
  const bowlerNameMaxW = bowlO - marginX - 12;  // 556 - 32 - 12 = 512

  const rowH = 40;

  const battingTeam = match.teams.find((t) => t.id === innings.battingTeamId);
  const bowlingTeam = match.teams.find((t) => t.id === innings.bowlingTeamId);
  const playerName  = (id: string) => battingTeam?.players.find((p) => p.id === id)?.name ?? 'Player';
  const bowlerName  = (id: string) => bowlingTeam?.players.find((p) => p.id === id)?.name ?? 'Bowler';
  const rr          = computeRunRate(stats.totalRuns, stats.legalBalls);

  // ── Card background ──
  const cardPad = 12;
  fillRoundRect(ctx, marginX - cardPad, y - cardPad, cardW + cardPad * 2, 10000, 16, C.surface);
  // (height placeholder — just establishes the colour layer; real content is drawn over)

  // ── Team header ──
  drawText(ctx, battingTeam?.name ?? '?', marginX, y + 16, { size: 16, weight: '800', color: C.fg });
  const label = `${innings.inningsNumber === 1 ? '1st' : '2nd'} Innings`;
  drawText(ctx, label, marginX, y + 32, { size: 11, weight: '400', color: C.muted });
  const scoreStr = formatScore(stats.totalRuns, stats.wickets);
  drawText(ctx, scoreStr, cardRight, y + 18, { size: 26, weight: '900', color: C.gold, align: 'right' });
  drawText(ctx, `${formatOversShort(stats.legalBalls)} ov  ·  RR ${rr.toFixed(2)}`,
    cardRight, y + 34, { size: 11, color: C.muted, align: 'right' });
  y += 48;

  gradientLine(ctx, marginX - cardPad, y, cardW + cardPad * 2, C.gold);
  y += 14;

  // ── Batting section label ──
  drawText(ctx, 'BATTING', marginX, y + 11, { size: 9, weight: '800', color: C.mutedDim });
  y += 18;

  // ── Column headers ──
  drawText(ctx, 'R',    batR,   y + 12, { size: 10, weight: '700', color: C.mutedDim, align: 'right' });
  drawText(ctx, 'B',    batB,   y + 12, { size: 10, weight: '700', color: C.mutedDim, align: 'right' });
  drawText(ctx, '4s',  bat4s,  y + 12, { size: 10, weight: '700', color: C.four,     align: 'right' });
  drawText(ctx, '6s',  bat6s,  y + 12, { size: 10, weight: '700', color: C.six,      align: 'right' });
  drawText(ctx, 'SR',  batSR,  y + 12, { size: 10, weight: '700', color: C.mutedDim, align: 'right' });
  y += 16;
  hline(ctx, marginX - cardPad, y, cardW + cardPad * 2, C.borderFaint);
  y += 4;

  // ── Batting rows ──
  const orderedBatsmen = innings.battingOrder
    .map((id) => stats.batsmanScores[id])
    .filter(Boolean);

  orderedBatsmen.forEach((bs, idx) => {
    if (idx % 2 === 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      ctx.fillRect(marginX - cardPad, y, cardW + cardPad * 2, rowH);
    }
    const nameColor = bs.isOut ? C.muted : C.fg;
    // Name — top line
    drawText(ctx, playerName(bs.playerId), marginX, y + 15, {
      size: 13, weight: '600', color: nameColor, maxWidth: nameMaxW,
    });
    // Status — bottom line
    if (bs.isOut && bs.dismissalText) {
      drawText(ctx, bs.dismissalText, marginX, y + 29, {
        size: 9, color: C.mutedDim, maxWidth: nameMaxW,
      });
    } else if (!bs.isOut && bs.balls > 0) {
      drawText(ctx, 'not out', marginX, y + 29, { size: 9, weight: '700', color: C.runs });
    }
    // Stats
    const runsColor = bs.runs >= 50 ? C.gold : bs.runs >= 30 ? C.amber : C.fg;
    drawText(ctx, String(bs.runs),  batR,  y + 22, { size: 15, weight: '900', color: runsColor,   align: 'right' });
    drawText(ctx, String(bs.balls), batB,  y + 22, { size: 11,               color: C.muted,     align: 'right' });
    drawText(ctx, String(bs.fours), bat4s, y + 22, {
      size: 11, weight: bs.fours > 0 ? '700' : '400',
      color: bs.fours > 0 ? C.four : C.mutedDim, align: 'right',
    });
    drawText(ctx, String(bs.sixes), bat6s, y + 22, {
      size: 11, weight: bs.sixes > 0 ? '700' : '400',
      color: bs.sixes > 0 ? C.six : C.mutedDim, align: 'right',
    });
    const srStr   = bs.balls > 0 ? bs.strikeRate.toFixed(0) : '—';
    const srColor = bs.balls > 0 && bs.strikeRate >= 150 ? C.gold : C.muted;
    drawText(ctx, srStr, batSR, y + 22, { size: 10, color: srColor, align: 'right' });
    y += rowH;
  });

  // ── Yet to bat ──
  const usedIds  = new Set(innings.battingOrder);
  const yetToBat = (battingTeam?.players ?? []).filter((p) => !usedIds.has(p.id));
  if (yetToBat.length > 0) {
    hline(ctx, marginX - cardPad, y, cardW + cardPad * 2, C.borderFaint);
    y += 10;
    drawText(ctx, 'YET TO BAT', marginX, y + 10, { size: 9, weight: '800', color: C.mutedDim });
    y += 16;
    drawText(ctx, yetToBat.map((p) => p.name).join('  ·  '), marginX, y + 12, {
      size: 10, color: C.mutedDim, maxWidth: cardW,
    });
    y += 22;
  }

  // ── Extras + total ──
  hline(ctx, marginX - cardPad, y, cardW + cardPad * 2, C.border);
  y += 12;
  drawText(
    ctx,
    `Extras — Wd ${stats.extras.wides}  NB ${stats.extras.noBalls}  B ${stats.extras.byes}  LB ${stats.extras.legByes}`,
    marginX, y + 13, { size: 10, color: C.muted },
  );
  drawText(ctx, String(stats.extrasTotal), cardRight, y + 13, {
    size: 11, weight: '700', color: C.fg, align: 'right',
  });
  y += 28;

  // ── Bowling section ──
  hline(ctx, marginX - cardPad, y, cardW + cardPad * 2, C.border);
  y += 12;
  drawText(ctx, 'BOWLING', marginX, y + 11, { size: 9, weight: '800', color: C.mutedDim });
  y += 18;

  // Bowling column headers
  drawText(ctx, 'O',    bowlO,    y + 11, { size: 9, weight: '700', color: C.mutedDim, align: 'right' });
  drawText(ctx, 'M',    bowlM,    y + 11, { size: 9, weight: '700', color: C.mutedDim, align: 'right' });
  drawText(ctx, 'R',    bowlR,    y + 11, { size: 9, weight: '700', color: C.mutedDim, align: 'right' });
  drawText(ctx, 'W',    bowlW,    y + 11, { size: 9, weight: '700', color: C.wicket,   align: 'right' });
  drawText(ctx, 'Econ', bowlEcon, y + 11, { size: 9, weight: '700', color: C.mutedDim, align: 'right' });
  y += 16;
  hline(ctx, marginX - cardPad, y, cardW + cardPad * 2, C.borderFaint);
  y += 4;

  const bowlers = Object.values(stats.bowlerScores)
    .filter((b) => b.legalBalls > 0)
    .sort((a, bb) => {
      const ai = bowlingTeam?.players.findIndex((p) => p.id === a.playerId) ?? 0;
      const bi = bowlingTeam?.players.findIndex((p) => p.id === bb.playerId) ?? 0;
      return ai - bi;
    });

  const bowlRowH = 34;
  bowlers.forEach((bwl, idx) => {
    if (idx % 2 === 1) {
      ctx.fillStyle = 'rgba(255,255,255,0.025)';
      ctx.fillRect(marginX - cardPad, y, cardW + cardPad * 2, bowlRowH);
    }
    drawText(ctx, bowlerName(bwl.playerId), marginX, y + 18, {
      size: 13, weight: '600', color: C.fg, maxWidth: bowlerNameMaxW,
    });
    drawText(ctx, bowlerOversDisplay(bwl.legalBalls), bowlO,    y + 18, { size: 11, color: C.fg,    align: 'right' });
    drawText(ctx, String(bwl.maidens),                 bowlM,    y + 18, { size: 11, color: C.muted, align: 'right' });
    drawText(ctx, String(bwl.runs),                    bowlR,    y + 18, { size: 11, color: C.muted, align: 'right' });
    drawText(ctx, String(bwl.wickets), bowlW, y + 18, {
      size: 14, weight: '900', color: bwl.wickets > 0 ? C.wicket : C.muted, align: 'right',
    });
    const econColor = bwl.economy <= 6 ? C.runs : bwl.economy <= 9 ? C.amber : C.wicket;
    drawText(ctx, bwl.economy.toFixed(1), bowlEcon, y + 18, { size: 10, color: econColor, align: 'right' });
    y += bowlRowH;
  });

  y += cardPad; // bottom padding inside card
  return y;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function buildShareImage(
  match: Match,
  innings1: Innings,
  inn1Stats: InningsStats,
  innings2: Innings | null,
  inn2Stats: InningsStats | null,
): Promise<Blob | null> {
  try {
    const W       = 720;
    const marginX = 32;
    const cardW   = W - marginX * 2;

    // Generous canvas height — will be cropped to actual content
    const H = 2200;
    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // ── Background ──
    ctx.fillStyle = C.bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle radial glow top-centre (grass green)
    const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.75);
    glow.addColorStop(0,   'rgba(16,100,48,0.45)');
    glow.addColorStop(0.6, 'rgba(16,100,48,0.12)');
    glow.addColorStop(1,   'rgba(16,100,48,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    let y = 0;

    // ── Gold top accent bar ──
    const topBar = ctx.createLinearGradient(0, 0, W, 0);
    topBar.addColorStop(0,   C.gold + '00');
    topBar.addColorStop(0.2, C.gold);
    topBar.addColorStop(0.8, C.gold);
    topBar.addColorStop(1,   C.gold + '00');
    ctx.fillStyle = topBar;
    ctx.fillRect(0, 0, W, 4);
    y = 4;

    // ── Header ──
    y += 32;
    ctx.font = '44px system-ui';
    ctx.textAlign = 'center';
    ctx.fillStyle = C.fg;
    ctx.fillText('🏏', W / 2, y + 8);
    y += 56;

    // Match name
    drawText(ctx, match.name, W / 2, y,
      { size: 24, weight: '900', color: C.gold, align: 'center' });
    y += 32;

    // Teams vs
    const t0 = match.teams[0]?.name ?? '';
    const t1 = match.teams[1]?.name ?? '';
    const halfW = cardW / 2 - 32;
    drawText(ctx, t0, W / 2 - 18, y,
      { size: 16, weight: '800', color: C.fg, align: 'right', maxWidth: halfW });
    drawText(ctx, 'vs', W / 2, y,
      { size: 13, weight: '600', color: C.mutedDim, align: 'center' });
    drawText(ctx, t1, W / 2 + 18, y,
      { size: 16, weight: '800', color: C.fg, align: 'left', maxWidth: halfW });
    y += 30;

    // Result
    if (match.result?.resultText) {
      const winnerTeam  = match.result.winnerId
        ? match.teams.find((t) => t.id === match.result!.winnerId)
        : null;
      const resultColor = winnerTeam ? C.gold : C.muted;
      drawText(ctx, match.result.resultText, W / 2, y,
        { size: 14, weight: '700', color: resultColor, align: 'center' });
      y += 24;
    }

    gradientLine(ctx, marginX, y + 4, cardW, C.gold);
    y += 24;

    // ── 1st Innings ──
    y = drawInnings(ctx, match, innings1, inn1Stats, y, cardW, marginX);
    y += 32;

    // ── 2nd Innings ──
    if (innings2 && inn2Stats) {
      gradientLine(ctx, marginX, y, cardW, C.border);
      y += 24;
      y = drawInnings(ctx, match, innings2, inn2Stats, y, cardW, marginX);
      y += 20;
    }

    // ── Footer ──
    gradientLine(ctx, marginX, y + 8, cardW, C.gold);
    y += 28;
    drawText(ctx, 'CricScore', W / 2, y,
      { size: 11, color: C.mutedDim, align: 'center' });
    y += 18;
    drawText(
      ctx,
      new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      W / 2, y, { size: 10, color: C.mutedDim, align: 'center' },
    );
    y += 16;

    // Crop to actual content height
    const finalH = Math.min(y + 48, H);
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width  = W;
    finalCanvas.height = finalH;
    const fctx = finalCanvas.getContext('2d');
    if (!fctx) return null;
    fctx.drawImage(canvas, 0, 0);

    return await new Promise<Blob | null>((resolve) => {
      finalCanvas.toBlob((blob) => resolve(blob), 'image/png', 1.0);
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
