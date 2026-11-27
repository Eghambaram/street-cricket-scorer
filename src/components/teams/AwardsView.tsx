import { useEffect, useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Image, Share2, Info, Sparkles } from 'lucide-react';
import { Spinner } from '@/components/common/Spinner';
import { Modal } from '@/components/common/Modal';
import { getAllMatches } from '@/db/repos/matchRepo';
import { getAllInnings } from '@/db/repos/inningsRepo';
import { getAllDeliveries } from '@/db/repos/playerRepo';
import { useUIStore } from '@/store/uiStore';
import { cn } from '@/utils/cn';
import {
  MVP_RULE, SEASON_QUALIFICATION, WEEK_QUALIFICATION,
  buildAwardsShareText, computeAwardsData, scopeStartFor, weekOf, weekRange,
} from '@/utils/awards';
import type { RosterPlayer } from '@/utils/awards';
import type { AwardResult } from '@/types/awards.types';
import type { Delivery } from '@/types/delivery.types';
import type { Innings, Match } from '@/types/match.types';
import type { SavedTeam } from '@/types/player.types';
import type { Season } from '@/types/season.types';

interface Props {
  season?: Season;
  teams: SavedTeam[];
}

const MEDALS = ['🥇', '🥈', '🥉'] as const;

type ExportFormat = 'excel' | 'png' | 'pdf';
const EXPORT_FORMATS: Record<ExportFormat, { label: string; ext: string; desc: string; Icon: typeof Image; tint: string }> = {
  png: { label: 'Image (PNG)', ext: 'png', desc: 'Awards poster for WhatsApp or Instagram', Icon: Image, tint: 'bg-four/15 text-four' },
  pdf: { label: 'PDF', ext: 'pdf', desc: 'Same poster as a document — print or pin up', Icon: FileText, tint: 'bg-wicket/15 text-wicket' },
  excel: { label: 'Excel', ext: 'xlsx', desc: 'Full stats workbook — match log, leaderboard, awards', Icon: FileSpreadsheet, tint: 'bg-safe/15 text-safe' },
};
const GROUPS = ['Batting', 'Bowling', 'Fielding & All-round'] as const;

/**
 * Share the file (phone share sheet) or download it. Building the workbook takes
 * a few seconds, after which browsers may refuse `share()` because the tap is no
 * longer "recent" (NotAllowedError) — that, or no file-share support, falls back
 * to a download so the file is never lost.
 */
async function deliverFile(blob: Blob, fileName: string, title: string): Promise<'shared' | 'cancelled' | 'downloaded'> {
  const file = new File([blob], fileName, { type: blob.type });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title });
      return 'shared';
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return 'cancelled';
    }
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
  return 'downloaded';
}

const shortDate = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/** Weekly / season awards: live podiums for the 15 stat awards plus Excel and WhatsApp export. */
export function AwardsView({ season, teams }: Props) {
  const { addToast } = useUIStore();
  const [raw, setRaw] = useState<{ matches: Match[]; innings: Innings[]; deliveries: Delivery[] } | null>(null);
  const [week, setWeek] = useState<number | null>(null);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [showExport, setShowExport] = useState(false);
  const [showRules, setShowRules] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([getAllMatches(), getAllInnings(), getAllDeliveries()]).then(([matches, innings, deliveries]) => {
      if (alive) setRaw({ matches, innings, deliveries });
    });
    return () => { alive = false; };
  }, []);

  useEffect(() => { setWeek(null); }, [season?.id]);

  // One entry per club player (the same person can be saved in several squads)
  const roster: RosterPlayer[] = useMemo(() => [
    ...new Map(teams.flatMap((t) => t.players.map((p) => [p.id, { id: p.id, name: p.name }] as const))).values(),
  ], [teams]);

  const data = useMemo(
    () => (raw ? computeAwardsData({ ...raw, roster, season, week: week ?? undefined }) : null),
    [raw, roster, season, week],
  );
  const scopeStart = raw ? scopeStartFor(raw.matches, season) : Date.now();
  const currentWeek = season && Date.now() <= season.endAt ? weekOf(Date.now(), scopeStart) : null;

  if (!raw || !data) return <div className="flex justify-center py-12"><Spinner /></div>;

  const title = season?.name ?? 'All matches';
  const scopeLabel = week
    ? `Week ${week} · ${shortDate(weekRange(scopeStart, week).start)}–${shortDate(weekRange(scopeStart, week).end)}`
    : season ? 'Season to date' : 'All completed matches';
  const playersInScope = data.totals.filter((t) => t.matches > 0).length;
  const statAwards = data.awards.filter((a) => a.category.kind === 'stat');
  const specialAwards = data.awards.filter((a) => a.category.kind === 'special');

  const handleShareText = async () => {
    const text = buildAwardsShareText(`${title} Awards`, `${scopeLabel} · ${data.matchCount} matches`, data.awards);
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); addToast('Winners copied — paste in WhatsApp', 'success'); }
    } catch {
      // Share sheet dismissed — nothing to do
    }
  };

  const buildFile = async (format: ExportFormat): Promise<Blob> => {
    const poster = { title: `${title} Awards`, scopeLabel, matchCount: data.matchCount, awards: data.awards, qualification: data.qualification };
    if (format === 'png') return (await import('@/utils/awardsPoster')).awardsPosterPng(poster);
    if (format === 'pdf') return (await import('@/utils/awardsPoster')).awardsPosterPdf(poster);
    const { buildAwardsWorkbook } = await import('@/utils/awardsWorkbook');
    // Season export also carries a week-by-week winners sheet
    const weekByWeek = week ? [] : data.weeksWithMatches.map((w) => ({
      week: w,
      label: `Week ${w} · ${shortDate(weekRange(scopeStart, w).start)}`,
      awards: computeAwardsData({ ...raw, roster, season, week: w }).awards,
    }));
    return buildAwardsWorkbook({ title: `${title} Awards`, scopeLabel, season, data, weekByWeek });
  };

  const handleExport = async (format: ExportFormat) => {
    const { label, ext } = EXPORT_FORMATS[format];
    setExporting(format);
    try {
      const blob = await buildFile(format);
      const fileName = `${slug(title)}-awards-${week ? `week-${week}` : 'season'}-${new Date().toISOString().slice(0, 10)}.${ext}`;
      const outcome = await deliverFile(blob, fileName, `${title} Awards`);
      if (outcome === 'downloaded') addToast(`${label} saved to Downloads`, 'success');
      if (outcome !== 'cancelled') setShowExport(false);
    } catch (err) {
      // Show the real reason so a failure can be diagnosed from the phone
      const reason = err instanceof Error ? err.message : String(err);
      addToast(`Could not create the ${label} file: ${reason}`, 'error');
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="px-4 space-y-3">
      {/* ── Week selector ── */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4">
        <WeekChip label={season ? 'Season' : 'All'} active={week === null} onClick={() => setWeek(null)} />
        {data.weeksWithMatches.map((w) => (
          <WeekChip key={w} label={`W${w}`} active={week === w} current={w === currentWeek} onClick={() => setWeek(w)} />
        ))}
      </div>

      {/* ── Hero: scope + actions ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-gold/25 via-gold/10 to-transparent border border-gold/30 p-4">
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[2px] text-gold/80">{title} Awards</p>
            <p className="text-white font-black text-lg leading-tight mt-0.5">{scopeLabel}</p>
            <p className="text-muted text-xs mt-1">
              {data.matchCount} match{data.matchCount !== 1 ? 'es' : ''} · {playersInScope} players · 15 stat awards + 5 special
            </p>
          </div>
          <button
            onClick={() => setShowRules(true)}
            className="w-9 h-9 flex items-center justify-center rounded-xl text-muted hover:text-gold shrink-0"
            aria-label="How awards are decided"
          >
            <Info size={16} />
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => setShowExport(true)}
            disabled={data.matchCount === 0}
            className="flex-[3] min-h-[48px] rounded-xl bg-gold text-[#1a0e04] font-black text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            <Download size={17} /> Export
          </button>
          <button
            onClick={handleShareText}
            disabled={data.matchCount === 0}
            className="flex-[2] min-h-[48px] rounded-xl bg-pitch-dark/60 border border-white/10 text-white font-bold text-sm flex items-center justify-center gap-2 active:scale-[0.98] transition-all disabled:opacity-40"
          >
            <Share2 size={15} /> Share
          </button>
        </div>
      </div>

      {data.matchCount === 0 ? (
        <div className="text-center py-12 px-6">
          <p className="text-4xl select-none">🏆</p>
          <p className="text-white font-bold mt-3">No counted matches {week ? 'this week' : 'yet'}</p>
          <p className="text-muted text-sm mt-1">Complete a match marked for {season?.name ?? 'stats'} to see the awards race.</p>
        </div>
      ) : (
        <>
          {GROUPS.map((group) => (
            <section key={group} className="space-y-2">
              <p className="text-muted text-[11px] font-black uppercase tracking-wider pt-1">{group}</p>
              {statAwards.filter((a) => a.category.group === group).map((a) => (
                <AwardCard key={a.category.no} award={a} />
              ))}
            </section>
          ))}

          {/* Special awards — decided by people, not numbers */}
          <section className="rounded-2xl bg-pitch-light border border-dashed border-white/10 p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles size={14} className="text-gold" />
              <p className="text-white text-sm font-bold">Special awards · organizer picks</p>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {specialAwards.map((a) => (
                <span key={a.category.no} className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-pitch-dark text-muted">
                  {a.category.name}
                </span>
              ))}
            </div>
            <p className="text-muted/70 text-[11px] mt-2">Fill these in on the Awards sheet of the Excel export.</p>
          </section>
        </>
      )}

      {/* ── Export format sheet ── */}
      <Modal isOpen={showExport} onClose={() => !exporting && setShowExport(false)} title="Export awards">
        <p className="text-muted text-xs mb-3">{title} · {scopeLabel}</p>
        <div className="space-y-2 pb-1">
          {(Object.keys(EXPORT_FORMATS) as ExportFormat[]).map((format) => {
            const { label, desc, Icon, tint } = EXPORT_FORMATS[format];
            const busy = exporting === format;
            return (
              <button
                key={format}
                onClick={() => handleExport(format)}
                disabled={!!exporting}
                className="w-full flex items-center gap-3 rounded-2xl bg-pitch-dark border border-white/[0.07] px-4 py-3 text-left hover:border-gold/30 active:scale-[0.98] transition-all disabled:opacity-60"
              >
                <span className={cn('w-11 h-11 rounded-xl flex items-center justify-center shrink-0', tint)}>
                  {busy ? <Spinner /> : <Icon size={20} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-white text-sm font-black">{busy ? `Building ${label}…` : label}</span>
                  <span className="block text-muted text-[11px] leading-snug">{desc}</span>
                </span>
              </button>
            );
          })}
        </div>
      </Modal>

      <Modal isOpen={showRules} onClose={() => setShowRules(false)} title="How awards are decided">
        <ul className="space-y-2.5 text-xs text-muted leading-relaxed pb-1">
          <li><span className="text-white font-semibold">Same matches as the leaderboard</span> — completed, marked for the season, not abandoned. Club roster players only.</li>
          <li><span className="text-white font-semibold">Weeks</span> run in 7-day blocks from the season start. Week view shows that week only; Season shows everything so far.</li>
          <li>
            <span className="text-white font-semibold">Qualification</span> for average, strike rate and economy:
            season min {SEASON_QUALIFICATION.minBallsFaced} balls faced / {SEASON_QUALIFICATION.minBallsBowled / 6} overs;
            week min {WEEK_QUALIFICATION.minBallsFaced} balls / {WEEK_QUALIFICATION.minBallsBowled / 6} overs.
          </li>
          <li><span className="text-white font-semibold">Ties share the place</span> — two 2nd places means no 3rd.</li>
          <li><span className="text-white font-semibold">All-Rounder (MVP)</span> = {MVP_RULE}.</li>
          <li><span className="text-white font-semibold">Fielding</span> awards count wickets where the scorer picked the fielder.</li>
          <li><span className="text-white font-semibold">Excel export</span> follows the club tracker: Match Log, Leaderboard (live formulas), Awards and Week by Week. Verify before publishing.</li>
        </ul>
      </Modal>
    </div>
  );
}

function WeekChip({ label, active, current, onClick }: { label: string; active: boolean; current?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'relative shrink-0 min-w-[44px] px-3.5 py-1.5 rounded-full text-xs font-bold transition-all',
        active ? 'bg-gold text-pitch-dark shadow-sm' : 'bg-pitch-light text-muted hover:text-white',
      )}
    >
      {label}
      {current && !active && <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-safe" aria-label="This week" />}
    </button>
  );
}

function AwardCard({ award }: { award: AwardResult }) {
  const { category, places, note } = award;
  return (
    <div className="rounded-2xl bg-pitch-light border border-white/[0.06] overflow-hidden">
      <div className="flex items-baseline justify-between gap-2 px-4 pt-3">
        <p className="text-white text-sm font-black truncate">{category.name}</p>
        <p className="text-muted/60 text-[10px] font-semibold shrink-0">#{category.no}</p>
      </div>
      <p className="text-muted text-[11px] px-4 leading-snug">{category.basis}</p>
      {places.length === 0 ? (
        <p className="text-muted/60 text-xs px-4 py-3">No qualifier yet{note ? ` · ${note}` : ''}</p>
      ) : (
        <div className="px-2 pb-2 pt-1.5 space-y-0.5">
          {places.map((p) => (
            <div
              key={p.position}
              className={cn(
                'flex items-center gap-2.5 px-2 py-1.5 rounded-xl',
                p.position === 1 && 'bg-gold/10',
              )}
            >
              <span className="text-base leading-none select-none w-5 text-center">{MEDALS[p.position - 1]}</span>
              <span className={cn('flex-1 min-w-0 truncate text-sm', p.position === 1 ? 'text-gold font-black' : 'text-white font-semibold')}>
                {p.players.map((x) => x.name).join(' & ')}
                {p.players.length > 1 && <span className="text-muted text-[10px] font-semibold ml-1">shared</span>}
              </span>
              <span className={cn('text-sm font-black tabular-nums shrink-0', p.position === 1 ? 'text-gold' : 'text-white/80')}>
                {p.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
