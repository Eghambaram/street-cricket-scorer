/**
 * Awards poster — a shareable image (PNG) or printable page (PDF) of the award
 * podiums, drawn on a canvas in the same dark style as the team-split card.
 */
import type { AwardResult, Qualification } from '@/types/awards.types';
import { jpegToPdf } from '@/utils/simplePdf';

export interface PosterInput {
  title: string;        // "Season 1 Awards"
  scopeLabel: string;   // "Week 3 · 15–21 Dec"
  matchCount: number;
  awards: AwardResult[];
  qualification: Qualification;
}

const W = 1080;
const PAD = 48;
const GAP = 20;
const COL_W = (W - PAD * 2 - GAP) / 2;
const CARD_H = 214;
const GROUP_H = 58;
const SCALE = 1.5;

const BG = '#0C0F0A';
const CARD = '#141810';
const GOLD = '#FFB800';
const TEXT = '#E8F0E2';
const MUTED = '#8FA883';
const MEDALS = ['🥇', '🥈', '🥉'];
const GROUPS = ['Batting', 'Bowling', 'Fielding & All-round'] as const;
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function text(
  ctx: CanvasRenderingContext2D, value: string, x: number, y: number,
  { size = 16, weight = 600, color = TEXT, align = 'left' as CanvasTextAlign, maxWidth = 0 } = {},
) {
  ctx.font = `${weight} ${size}px ${FONT}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  let s = value;
  if (maxWidth > 0 && ctx.measureText(s).width > maxWidth) {
    while (s.length > 1 && ctx.measureText(`${s}…`).width > maxWidth) s = s.slice(0, -1);
    s = `${s}…`;
  }
  ctx.fillText(s, x, y);
}

function drawCard(ctx: CanvasRenderingContext2D, a: AwardResult, x: number, y: number) {
  roundRect(ctx, x, y, COL_W, CARD_H, 18);
  ctx.fillStyle = CARD;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,184,0,0.18)';
  ctx.lineWidth = 1;
  ctx.stroke();

  text(ctx, a.category.name, x + 20, y + 36, { size: 21, weight: 800, maxWidth: COL_W - 40 });
  text(ctx, a.category.basis, x + 20, y + 60, { size: 13, weight: 500, color: MUTED, maxWidth: COL_W - 40 });

  if (a.places.length === 0) {
    text(ctx, a.note ? `No qualifier yet · ${a.note}` : 'No qualifier yet', x + 20, y + 112, { size: 15, weight: 500, color: MUTED, maxWidth: COL_W - 40 });
    return;
  }
  a.places.forEach((p, i) => {
    const rowY = y + 84 + i * 42;
    if (p.position === 1) {
      roundRect(ctx, x + 10, rowY, COL_W - 20, 38, 10);
      ctx.fillStyle = 'rgba(255,184,0,0.10)';
      ctx.fill();
    }
    const first = p.position === 1;
    const value = p.value;
    ctx.font = `800 18px ${FONT}`;
    const valueW = ctx.measureText(value).width;
    text(ctx, MEDALS[p.position - 1], x + 22, rowY + 27, { size: 20 });
    const names = p.players.map((pl) => pl.name).join(' & ') + (p.players.length > 1 ? ' (shared)' : '');
    text(ctx, names, x + 56, rowY + 26, { size: 18, weight: first ? 800 : 600, color: first ? GOLD : TEXT, maxWidth: COL_W - 96 - valueW });
    text(ctx, value, x + COL_W - 22, rowY + 26, { size: 18, weight: 800, color: first ? GOLD : TEXT, align: 'right' });
  });
}

export function drawAwardsPoster(input: PosterInput): HTMLCanvasElement {
  const stat = input.awards.filter((a) => a.category.kind === 'stat');
  const special = input.awards.filter((a) => a.category.kind === 'special');
  const groups = GROUPS.map((g) => stat.filter((a) => a.category.group === g)).filter((g) => g.length);
  const rows = groups.reduce((s, g) => s + Math.ceil(g.length / 2), 0);

  const HEADER_H = 210;
  const SPECIAL_H = 150;
  const FOOTER_H = 70;
  const H = PAD + HEADER_H + groups.length * GROUP_H + rows * (CARD_H + GAP) + SPECIAL_H + FOOTER_H + PAD;

  const canvas = document.createElement('canvas');
  canvas.width = W * SCALE;
  canvas.height = H * SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not available');
  ctx.scale(SCALE, SCALE);

  // Background + gold glow
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, W, H);
  const glow = ctx.createRadialGradient(W / 2, 0, 0, W / 2, 0, W * 0.9);
  glow.addColorStop(0, 'rgba(16,100,48,0.55)');
  glow.addColorStop(1, 'rgba(16,100,48,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  const bar = ctx.createLinearGradient(0, 0, W, 0);
  bar.addColorStop(0, 'rgba(255,184,0,0)');
  bar.addColorStop(0.5, GOLD);
  bar.addColorStop(1, 'rgba(255,184,0,0)');
  ctx.fillStyle = bar;
  ctx.fillRect(0, 0, W, 5);

  // Header
  let y = PAD;
  text(ctx, '🏆', W / 2, y + 56, { size: 56, align: 'center' });
  text(ctx, input.title.toUpperCase(), W / 2, y + 112, { size: 40, weight: 900, color: GOLD, align: 'center', maxWidth: W - PAD * 2 });
  text(ctx, input.scopeLabel, W / 2, y + 150, { size: 22, weight: 700, align: 'center' });
  const date = new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
  text(ctx, `${input.matchCount} match${input.matchCount !== 1 ? 'es' : ''} · published ${date}`, W / 2, y + 180, { size: 15, weight: 500, color: MUTED, align: 'center' });
  y += HEADER_H;

  // Award groups, two cards per row
  for (const group of groups) {
    text(ctx, group[0].category.group.toUpperCase(), PAD, y + 36, { size: 16, weight: 900, color: GOLD });
    ctx.fillStyle = 'rgba(255,184,0,0.25)';
    ctx.fillRect(PAD, y + 46, W - PAD * 2, 1);
    y += GROUP_H;
    group.forEach((a, i) => {
      const col = i % 2;
      const row = Math.floor(i / 2);
      drawCard(ctx, a, PAD + col * (COL_W + GAP), y + row * (CARD_H + GAP));
    });
    y += Math.ceil(group.length / 2) * (CARD_H + GAP);
  }

  // Special awards — organizer picks
  roundRect(ctx, PAD, y + 10, W - PAD * 2, SPECIAL_H - 30, 18);
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.stroke();
  ctx.setLineDash([]);
  text(ctx, '✨ Special awards · organizer picks', PAD + 22, y + 46, { size: 18, weight: 800 });
  text(ctx, special.map((a) => a.category.name).join('  ·  '), PAD + 22, y + 80, { size: 15, weight: 500, color: MUTED, maxWidth: W - PAD * 2 - 44 });
  const q = input.qualification;
  text(ctx, `Average & strike rate need ${q.minBallsFaced}+ balls faced · economy needs ${q.minBallsBowled / 6}+ overs · ties share the place`, PAD + 22, y + 108, { size: 13, weight: 500, color: MUTED, maxWidth: W - PAD * 2 - 44 });
  y += SPECIAL_H;

  text(ctx, '🏏  CricScore', W / 2, y + 36, { size: 15, weight: 700, color: '#4D5E47', align: 'center' });
  return canvas;
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not draw the poster'))), type, quality);
  });

export async function awardsPosterPng(input: PosterInput): Promise<Blob> {
  return toBlob(drawAwardsPoster(input), 'image/png');
}

export async function awardsPosterPdf(input: PosterInput): Promise<Blob> {
  const canvas = drawAwardsPoster(input);
  const jpeg = new Uint8Array(await (await toBlob(canvas, 'image/jpeg', 0.92)).arrayBuffer());
  return jpegToPdf(jpeg, canvas.width, canvas.height, input.title);
}
