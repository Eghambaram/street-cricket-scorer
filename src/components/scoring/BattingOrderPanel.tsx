import { useState } from 'react';
import { ChevronDown, ChevronUp, HeartPulse } from 'lucide-react';
import { cn } from '@/utils/cn';
import type { Innings, Match } from '@/types/match.types';
import type { InningsStats } from '@/types/delivery.types';

interface Props {
  match: Match;
  innings: Innings;
  stats: InningsStats;
}

export function BattingOrderPanel({ match, innings, stats }: Props) {
  const [expanded, setExpanded] = useState(false);

  const battingTeam = match.teams.find((t) => t.id === innings.battingTeamId);
  if (!battingTeam) return null;

  const strikerId = innings.currentBatsmanIds[innings.strikerIndex] ?? '';
  const nonStrikerId = innings.currentBatsmanIds[innings.strikerIndex ^ 1] ?? '';
  const atCrease = new Set([strikerId, nonStrikerId].filter(Boolean));
  const retiredHurtIds = new Set(innings.retiredHurtIds ?? []);

  const dismissedIds = new Set(
    Object.entries(stats.batsmanScores)
      .filter(([, sc]) => sc.isOut)
      .map(([id]) => id),
  );

  // Build batting order sections in order
  const batted = innings.battingOrder.map((id) => {
    const player = battingTeam.players.find((p) => p.id === id);
    const sc = stats.batsmanScores[id];
    return { id, name: player?.name ?? id, sc };
  });

  const atCreaseList = batted.filter((b) => atCrease.has(b.id));
  const retiredList = batted.filter((b) => retiredHurtIds.has(b.id));
  const outList = batted.filter((b) => dismissedIds.has(b.id));

  // Yet to bat = team players not in batting order yet and not retired/dismissed
  const yetToBat = battingTeam.players.filter(
    (p) => !innings.battingOrder.includes(p.id) && !retiredHurtIds.has(p.id),
  );

  const wicketCount = outList.length;

  // Next batter on deck (first player in yetToBat list)
  const onDeck = yetToBat[0];

  return (
    <div className="mx-3 mb-2 bg-pitch-light rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[48px] active:bg-pitch-light/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-semibold text-white">Batting Order</span>
          <span className="text-xs text-muted font-mono shrink-0">
            {wicketCount} wkt{wicketCount !== 1 ? 's' : ''}
          </span>
          {!expanded && onDeck && (
            <span className="text-xs text-muted truncate">
              · <span className="text-white/70">Next: {onDeck.name}</span>
            </span>
          )}
        </div>
        {expanded ? <ChevronUp size={16} className="text-muted shrink-0" /> : <ChevronDown size={16} className="text-muted shrink-0" />}
      </button>

      {expanded && (
        <div className="border-t border-pitch/60 px-3 py-2 space-y-0.5">
          {/* At Crease */}
          {atCreaseList.map((b) => {
            const isStriker = b.id === strikerId;
            return (
              <BatRow
                key={b.id}
                name={b.name}
                label={isStriker ? '★ Striker' : 'Non-Striker'}
                labelClass="text-gold"
                runs={b.sc?.runs}
                balls={b.sc?.balls}
                highlight
              />
            );
          })}

          {/* Retired Hurt */}
          {retiredList.length > 0 && (
            <>
              {retiredList.map((b) => (
                <BatRow
                  key={b.id}
                  name={b.name}
                  labelIcon={<HeartPulse size={11} className="text-gold inline mr-0.5" />}
                  label="Retired Hurt"
                  labelClass="text-gold"
                  runs={b.sc?.runs}
                  balls={b.sc?.balls}
                />
              ))}
              <p className="text-[10px] text-muted/60 px-1 pb-0.5">
                Tap a batsman name above to recall a retired player
              </p>
            </>
          )}

          {/* Out */}
          {outList.map((b) => (
            <BatRow
              key={b.id}
              name={b.name}
              label={b.sc?.dismissalText ?? 'out'}
              labelClass="text-wicket/80"
              runs={b.sc?.runs}
              balls={b.sc?.balls}
              dimmed
            />
          ))}

          {/* Yet to bat */}
          {yetToBat.map((p) => (
            <BatRow key={p.id} name={p.name} label="yet to bat" labelClass="text-muted" dimmed />
          ))}
        </div>
      )}
    </div>
  );
}

interface BatRowProps {
  name: string;
  label?: string;
  labelIcon?: React.ReactNode;
  labelClass?: string;
  runs?: number;
  balls?: number;
  highlight?: boolean;
  dimmed?: boolean;
}

function BatRow({ name, label, labelIcon, labelClass, runs, balls, highlight, dimmed }: BatRowProps) {
  return (
    <div className={cn('flex items-center gap-2 py-1.5 px-1 rounded-lg', highlight && 'bg-gold/5')}>
      <div className="flex-1 min-w-0">
        <span className={cn('text-sm font-semibold truncate block', dimmed ? 'text-muted' : 'text-white')}>
          {name}
        </span>
        {label && (
          <span className={cn('text-xs leading-none', labelClass)}>
            {labelIcon}{label}
          </span>
        )}
      </div>
      {runs !== undefined && (
        <span className={cn('text-sm font-mono font-bold flex-shrink-0', dimmed ? 'text-muted' : 'text-white')}>
          {runs}
          {balls !== undefined && (
            <span className="text-muted font-normal text-xs"> ({balls})</span>
          )}
        </span>
      )}
    </div>
  );
}
