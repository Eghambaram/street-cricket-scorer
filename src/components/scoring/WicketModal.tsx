import { useState, useEffect } from 'react';
import { CheckCircle2, UserRound, Shield } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { cn } from '@/utils/cn';
import type { Innings, Match } from '@/types/match.types';
import type { WicketType, Wicket, DeliveryExtras } from '@/types/delivery.types';

interface Props {
  isOpen: boolean;
  match: Match;
  innings: Innings;
  isFreeHit?: boolean;
  onConfirm: (wicket: Wicket, nextBatsmanId: string | null, runs: number, extras: DeliveryExtras) => void;
  onRetireHurt: (batsmanId: string, nextBatsmanId: string | null) => void;
  onCancel: () => void;
}

const dismissalTypes: {
  type: WicketType;
  label: string;
  needsFielder: boolean;
  fielderLabel: string;
  needsBatsmanChoice: boolean;
}[] = [
  { type: 'bowled',           label: 'Bowled',     needsFielder: false, fielderLabel: '',          needsBatsmanChoice: false },
  { type: 'caught',           label: 'Caught',     needsFielder: true,  fielderLabel: 'Catcher',   needsBatsmanChoice: false },
  { type: 'run_out',          label: 'Run Out',    needsFielder: true,  fielderLabel: 'Fielder',   needsBatsmanChoice: true  },
  { type: 'stumped',          label: 'Stumped',    needsFielder: true,  fielderLabel: 'Stumper',   needsBatsmanChoice: false },
  { type: 'hit_wicket',       label: 'Hit Wicket', needsFielder: false, fielderLabel: '',          needsBatsmanChoice: false },
  { type: 'lbw',              label: 'LBW',        needsFielder: false, fielderLabel: '',          needsBatsmanChoice: false },
  { type: 'one_tip_one_hand', label: '1T1H',       needsFielder: true,  fielderLabel: 'Fielder',   needsBatsmanChoice: false },
];

type Mode = 'dismissal' | 'retire_hurt';

// Steps within dismissal mode
type Step = 'how_out' | 'fielder' | 'next_batsman';

function PickButton({
  name,
  sub,
  selected,
  onClick,
  accent = 'gold',
}: {
  name: string;
  sub?: string;
  selected: boolean;
  onClick: () => void;
  accent?: 'gold' | 'wicket';
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between px-4 py-3 rounded-xl border text-left transition-all active:scale-[0.98]',
        selected && accent === 'gold'   && 'bg-gold/15 border-gold',
        selected && accent === 'wicket' && 'bg-wicket/15 border-wicket',
        !selected && 'bg-pitch-dark border-pitch-light hover:border-white/30',
      )}
    >
      <span className={cn(
        'font-semibold text-sm',
        selected && accent === 'gold'   && 'text-gold',
        selected && accent === 'wicket' && 'text-wicket',
        !selected && 'text-white',
      )}>
        {name}
      </span>
      <div className="flex items-center gap-2">
        {sub && <span className="text-xs text-muted font-mono">{sub}</span>}
        {selected && <CheckCircle2 size={15} className={accent === 'gold' ? 'text-gold' : 'text-wicket'} />}
      </div>
    </button>
  );
}

// Compact step indicator
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-1.5 mb-4">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={cn(
            'rounded-full transition-all',
            i < current  && 'w-2 h-2 bg-gold',
            i === current && 'w-4 h-2 bg-gold',
            i > current  && 'w-2 h-2 bg-pitch-light',
          )}
        />
      ))}
    </div>
  );
}

// Running summary chip shown at top once something is selected
function SummaryChip({ parts }: { parts: string[] }) {
  if (parts.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5 mb-4">
      {parts.map((part, i) => (
        <span
          key={i}
          className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gold/10 border border-gold/25 text-gold text-xs font-bold"
        >
          {part}
        </span>
      ))}
    </div>
  );
}

// On a free hit, only run out is valid
const FREE_HIT_ALLOWED: WicketType[] = ['run_out'];

export function WicketModal({ isOpen, match, innings, isFreeHit = false, onConfirm, onRetireHurt, onCancel }: Props) {
  const [mode, setMode] = useState<Mode>('dismissal');
  const [step, setStep] = useState<Step>('how_out');
  const [selectedType, setSelectedType] = useState<WicketType | ''>('');
  const [fielderId, setFielderId] = useState('');
  const [runOutBatsmanId, setRunOutBatsmanId] = useState('');
  const [nextBatsmanId, setNextBatsmanId] = useState('');
  const [retireeBatsmanId, setRetireeBatsmanId] = useState('');
  const [runOutRuns, setRunOutRuns] = useState(0);
  const [runOutExtraType, setRunOutExtraType] = useState<'none' | 'bye' | 'leg_bye' | 'wide' | 'no_ball'>('none');

  const noLBW = match.rules.noLBW;
  const isSingle = match.config.isSinglePlayerMode;
  const retiredHurtAllowed = match.rules.retiredHurtAllowed;
  const isLastMan = innings.currentBatsmanIds.filter((id) => id && id !== '').length <= 1;

  const filteredTypes = dismissalTypes.filter((d) => {
    if (isFreeHit && !FREE_HIT_ALLOWED.includes(d.type)) return false;
    if (d.type === 'lbw' && noLBW) return false;
    if (d.type === 'one_tip_one_hand' && !match.rules.oneTipOneHand) return false;
    return true;
  });

  const bowlingTeam = match.teams.find((t) => t.id === innings.bowlingTeamId);
  const battingTeam = match.teams.find((t) => t.id === innings.battingTeamId);

  const usedPlayerIds = new Set([
    ...innings.battingOrder,
    ...(innings.retiredHurtIds ?? []),
  ]);
  const remainingBatsmen = battingTeam?.players.filter((p) => !usedPlayerIds.has(p.id)) ?? [];

  const selectedInfo = filteredTypes.find((d) => d.type === selectedType);
  const strikerId      = innings.currentBatsmanIds[innings.strikerIndex] ?? '';
  const nonStrikerId   = innings.currentBatsmanIds[innings.strikerIndex ^ 1] ?? '';
  const strikerName    = battingTeam?.players.find((p) => p.id === strikerId)?.name    ?? 'Striker';
  const nonStrikerName = battingTeam?.players.find((p) => p.id === nonStrikerId)?.name ?? 'Non-striker';
  const fielderName    = bowlingTeam?.players.find((p) => p.id === fielderId)?.name;
  const nextBatsmanName = battingTeam?.players.find((p) => p.id === nextBatsmanId)?.name;

  const atCreasePlayers = innings.currentBatsmanIds
    .filter((id): id is string => !!(id && id !== ''))
    .map((id) => battingTeam?.players.find((p) => p.id === id))
    .filter(Boolean) as { id: string; name: string }[];

  // Steps for this dismissal type
  const needsFielder = !isSingle && !!(selectedInfo?.needsFielder);
  const canContinueWithLoneBatsman = match.rules.lastManStands && !isLastMan && remainingBatsmen.length === 0;
  const needsNextBatsman = !isLastMan && !canContinueWithLoneBatsman && remainingBatsmen.length > 0;
  const steps: Step[] = ['how_out'];
  if (selectedType && needsFielder) steps.push('fielder');
  if (selectedType) steps.push('next_batsman');
  const stepIndex = steps.indexOf(step);
  const totalSteps = steps.length;

  // Reset fielder when dismissal type changes
  useEffect(() => {
    setFielderId('');
    setRunOutBatsmanId('');
  }, [selectedType]);

  // Reset everything when modal opens/closes
  useEffect(() => {
    if (!isOpen) return;
    setMode('dismissal');
    setStep('how_out');
    setSelectedType('');
    setFielderId('');
    setRunOutBatsmanId('');
    setNextBatsmanId('');
    setRetireeBatsmanId('');
    setRunOutRuns(0);
    setRunOutExtraType('none');
  }, [isOpen]);

  // Build summary chip parts
  const summaryParts: string[] = [];
  if (selectedType) summaryParts.push(selectedInfo?.label ?? selectedType);
  if (fielderId && fielderName) summaryParts.push(fielderName);
  if (nextBatsmanId && nextBatsmanName) summaryParts.push(`${nextBatsmanName} in`);

  // Confirm button label
  const confirmLabel = (() => {
    if (isLastMan) return 'Dismiss — End Innings';
    if (canContinueWithLoneBatsman) return 'Confirm Wicket — Continue with Last Batter';
    if (!needsNextBatsman) return 'Confirm Wicket';
    const typeLabel = selectedInfo?.label ?? '';
    const fielderPart = fielderName ? ` · ${fielderName}` : '';
    const nextPart = nextBatsmanName ? ` · ${nextBatsmanName} in` : '';
    return `Confirm: ${typeLabel}${fielderPart}${nextPart}`;
  })();

  const canAdvanceFromHowOut = !!selectedType;
  const canConfirm =
    !!selectedType &&
    (isLastMan || !needsNextBatsman || !!nextBatsmanId);

  const handleNext = () => {
    const nextStep = steps[stepIndex + 1];
    if (nextStep) setStep(nextStep);
  };

  const handleBack = () => {
    const prevStep = steps[stepIndex - 1];
    if (prevStep) setStep(prevStep);
  };



  const getRunOutDeliveryInput = (): { runs: number; extras: DeliveryExtras } => {
    if (selectedType !== 'run_out') return { runs: 0, extras: { wide: 0, noBall: 0, bye: 0, legBye: 0 } };
    if (runOutExtraType === 'wide') return { runs: 0, extras: { wide: 1 + runOutRuns, noBall: 0, bye: 0, legBye: 0 } };
    if (runOutExtraType === 'no_ball') return { runs: runOutRuns, extras: { wide: 0, noBall: 1, bye: 0, legBye: 0 } };
    if (runOutExtraType === 'bye') return { runs: 0, extras: { wide: 0, noBall: 0, bye: runOutRuns, legBye: 0 } };
    if (runOutExtraType === 'leg_bye') return { runs: 0, extras: { wide: 0, noBall: 0, bye: 0, legBye: runOutRuns } };
    return { runs: runOutRuns, extras: { wide: 0, noBall: 0, bye: 0, legBye: 0 } };
  };

  const handleDismissalConfirm = () => {
    if (!selectedType) return;
    const wicket: Wicket = {
      type: selectedType,
      fielderId: fielderId || undefined,
      runOutBatsmanId:
        selectedType === 'run_out'
          ? runOutBatsmanId || strikerId || undefined
          : undefined,
    };
    const input = getRunOutDeliveryInput();
    onConfirm(wicket, needsNextBatsman ? (nextBatsmanId || null) : null, input.runs, input.extras);
  };

  const handleRetireHurtConfirm = () => {
    const retiring = retireeBatsmanId || strikerId;
    const next = remainingBatsmen.length > 0 ? nextBatsmanId || null : null;
    onRetireHurt(retiring, next || null);
  };

  const handleCancel = () => {
    onCancel();
  };

  return (
    <Modal isOpen={isOpen} title={mode === 'retire_hurt' ? 'Retired Hurt' : isFreeHit ? 'Free Hit — Run Out Only' : 'Wicket!'} onClose={handleCancel}>

      {/* Free hit notice */}
      {isFreeHit && (
        <div className="flex items-center gap-2 bg-safe/15 border border-safe/40 rounded-xl px-3 py-2 mb-4">
          <span className="text-base select-none">🛡️</span>
          <p className="text-safe text-xs font-semibold">
            Free Hit — only <strong>Run Out</strong> is valid on this delivery
          </p>
        </div>
      )}

      {/* Mode toggle */}
      {retiredHurtAllowed && !isLastMan && (
        <div className="flex rounded-xl overflow-hidden border border-pitch-light mb-4">
          <button
            onClick={() => { setMode('dismissal'); setStep('how_out'); }}
            className={cn(
              'flex-1 py-2 text-sm font-semibold transition-colors',
              mode === 'dismissal' ? 'bg-wicket text-white' : 'bg-pitch-dark text-muted',
            )}
          >
            Dismissed
          </button>
          <button
            onClick={() => setMode('retire_hurt')}
            className={cn(
              'flex-1 py-2 text-sm font-semibold transition-colors',
              mode === 'retire_hurt' ? 'bg-gold text-pitch' : 'bg-pitch-dark text-muted',
            )}
          >
            Retired Hurt
          </button>
        </div>
      )}

      {/* ── DISMISSAL MODE ── */}
      {mode === 'dismissal' && (
        <>
          {/* Step dots — only shown when there's more than 1 step */}
          {totalSteps > 1 && <StepDots current={stepIndex} total={totalSteps} />}

          {/* Running summary chip */}
          <SummaryChip parts={summaryParts} />

          {/* ── STEP 1: How Out ── */}
          {step === 'how_out' && (
            <>
              <div className="grid grid-cols-3 gap-2 mb-5">
                {filteredTypes.map((d) => (
                  <button
                    key={d.type}
                    onClick={() => setSelectedType(d.type)}
                    className={cn(
                      'py-3 rounded-xl text-sm font-bold border transition-all active:scale-95',
                      selectedType === d.type
                        ? 'bg-wicket border-wicket text-white'
                        : 'bg-pitch-dark border-pitch-light text-muted hover:border-white/30',
                    )}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {/* Run-out: which batsman is out — shown inline on step 1 */}
              {selectedType === 'run_out' && !isLastMan && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <UserRound size={12} /> Which batsman is out?
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {([strikerId, nonStrikerId] as const).map((id, i) =>
                      id && id !== '' ? (
                        <PickButton
                          key={id}
                          name={i === 0 ? `● ${strikerName}` : nonStrikerName}
                          selected={runOutBatsmanId === id || (!runOutBatsmanId && i === 0)}
                          onClick={() => setRunOutBatsmanId(id)}
                          accent="wicket"
                        />
                      ) : null
                    )}
                  </div>
                </div>
              )}



              {selectedType === 'run_out' && (
                <div className="mb-4 bg-pitch-dark border border-pitch-light rounded-xl p-3">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Runs completed on this ball</p>
                  <div className="grid grid-cols-5 gap-1.5 mb-2">
                    {(['none','bye','leg_bye','wide','no_ball'] as const).map((type) => (
                      <button
                        key={type}
                        onClick={() => setRunOutExtraType(type)}
                        className={cn('py-1.5 rounded-lg text-[11px] font-bold border', runOutExtraType === type ? 'bg-gold/20 border-gold text-gold' : 'bg-pitch border-pitch-light text-muted')}
                      >
                        {type === 'none' ? 'Bat' : type === 'leg_bye' ? 'LB' : type === 'no_ball' ? 'NB' : type.toUpperCase()}
                      </button>
                    ))}
                  </div>
                  <div className="grid grid-cols-7 gap-1">
                    {[0,1,2,3,4,5,6].map((n) => (
                      <button
                        key={n}
                        onClick={() => setRunOutRuns(n)}
                        className={cn('py-1.5 rounded-lg text-xs font-bold border', runOutRuns === n ? 'bg-wicket/20 border-wicket text-wicket' : 'bg-pitch border-pitch-light text-muted')}
                      >{n}</button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="secondary" fullWidth onClick={handleCancel}>Cancel</Button>
                {totalSteps > 1 ? (
                  <Button variant="gold" fullWidth disabled={!canAdvanceFromHowOut} onClick={handleNext}>
                    Next →
                  </Button>
                ) : (
                  <Button variant="danger" fullWidth disabled={!canConfirm} onClick={handleDismissalConfirm}>
                    {confirmLabel}
                  </Button>
                )}
              </div>
            </>
          )}

          {/* ── STEP 2: Fielder ── */}
          {step === 'fielder' && (
            <>
              <div className="mb-1">
                <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Shield size={12} className="text-muted" />
                  {selectedInfo?.fielderLabel ?? 'Fielder'}
                  <span className="text-muted/50 font-normal normal-case tracking-normal">— optional</span>
                </p>
                <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
                  {/* Skip option */}
                  <PickButton
                    name="Skip — not recorded"
                    selected={fielderId === ''}
                    onClick={() => setFielderId('')}
                    accent="gold"
                  />
                  {bowlingTeam?.players.map((p) => (
                    <PickButton
                      key={p.id}
                      name={p.name}
                      selected={fielderId === p.id}
                      onClick={() => setFielderId(p.id)}
                      accent="gold"
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-3 mt-4">
                <Button variant="secondary" fullWidth onClick={handleBack}>← Back</Button>
                <Button variant="gold" fullWidth onClick={handleNext}>
                  Next →
                </Button>
              </div>
            </>
          )}

          {/* ── STEP 3: Next Batsman ── */}
          {step === 'next_batsman' && (
            <>
              {needsNextBatsman ? (
                <div className="mb-1">
                  <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2 flex items-center gap-1.5">
                    <UserRound size={12} className="text-muted" /> Next Batsman In
                  </p>
                  <div className="space-y-1.5 max-h-[40vh] overflow-y-auto pr-1">
                    {remainingBatsmen.map((p) => (
                      <PickButton
                        key={p.id}
                        name={p.name}
                        selected={nextBatsmanId === p.id}
                        onClick={() => setNextBatsmanId(p.id)}
                        accent="gold"
                      />
                    ))}
                  </div>
                </div>
              ) : isLastMan ? (
                <div className="bg-wicket/10 border border-wicket/30 rounded-xl py-3 px-4 mb-4 text-center">
                  <p className="text-wicket font-bold text-sm">Innings Over</p>
                  <p className="text-muted text-xs mt-0.5">Last man dismissed</p>
                </div>
              ) : (
                <div className="bg-pitch-dark rounded-xl py-3 px-4 mb-4 text-center">
                  <p className="text-muted text-sm">All batsmen used — Innings will end</p>
                </div>
              )}

              <div className="flex gap-3 mt-4">
                <Button variant="secondary" fullWidth onClick={handleBack}>← Back</Button>
                <Button
                  variant="danger"
                  fullWidth
                  disabled={!canConfirm}
                  onClick={handleDismissalConfirm}
                >
                  {confirmLabel}
                </Button>
              </div>
            </>
          )}
        </>
      )}

      {/* ── RETIRE HURT MODE ── */}
      {mode === 'retire_hurt' && (
        <>
          {atCreasePlayers.length > 1 && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <UserRound size={12} /> Who is retiring hurt?
              </p>
              <div className="grid grid-cols-2 gap-2">
                {atCreasePlayers.map((p) => (
                  <PickButton
                    key={p.id}
                    name={p.name}
                    selected={(retireeBatsmanId === p.id) || (!retireeBatsmanId && p.id === strikerId)}
                    onClick={() => setRetireeBatsmanId(p.id)}
                    accent="gold"
                  />
                ))}
              </div>
            </div>
          )}

          {remainingBatsmen.length > 0 ? (
            <div className="mb-3">
              <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <UserRound size={12} /> Replacement Batsman
                <span className="text-muted/50 font-normal normal-case tracking-normal">— optional</span>
              </p>
              <div className="space-y-1.5 max-h-[30vh] overflow-y-auto pr-1">
                <PickButton
                  name="No replacement now"
                  selected={nextBatsmanId === ''}
                  onClick={() => setNextBatsmanId('')}
                  accent="gold"
                />
                {remainingBatsmen.map((p) => (
                  <PickButton
                    key={p.id}
                    name={p.name}
                    selected={nextBatsmanId === p.id}
                    onClick={() => setNextBatsmanId(p.id)}
                    accent="gold"
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-gold/10 border border-gold/30 rounded-xl py-3 px-4 mb-4 text-center">
              <p className="text-gold text-sm font-semibold">No replacement available</p>
              <p className="text-muted text-xs mt-0.5">Recalled when a wicket falls</p>
            </div>
          )}

          <p className="text-muted text-xs text-center mb-4">
            Tap their name in the batting panel to recall when ready.
          </p>

          <div className="flex gap-3">
            <Button variant="secondary" fullWidth onClick={handleCancel}>Cancel</Button>
            <Button variant="gold" fullWidth onClick={handleRetireHurtConfirm}>Retire Hurt</Button>
          </div>
        </>
      )}
    </Modal>
  );
}
