import { useState, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { FormProvider, useForm } from 'react-hook-form';
import { v4 as uuid } from 'uuid';
import { BookmarkPlus, ChevronDown, ChevronUp } from 'lucide-react';
import { MatchConfigStep } from '@/components/setup/MatchConfigStep';
import { TeamsStep } from '@/components/setup/TeamsStep';
import { TossStep } from '@/components/setup/TossStep';
import { Button } from '@/components/common/Button';
import { TopBar } from '@/components/layout/TopBar';
import { useMatch } from '@/hooks/useMatch';
import { useUIStore } from '@/store/uiStore';
import { autoMatchName } from '@/utils/format';
import { DEFAULT_RULES, type FreeHitMode } from '@/types/rules.types';
import { DEFAULT_CONFIG } from '@/types/match.types';
import type { Match, Innings, Team } from '@/types/match.types';
import type { StreetCricketRules } from '@/types/rules.types';
import { saveInnings } from '@/db/repos/inningsRepo';
import { saveSavedTeam, getAllSavedTeams } from '@/db/repos/savedTeamRepo';
import type { SavedTeam } from '@/types/player.types';
import { useFormContext } from 'react-hook-form';
import { cn } from '@/utils/cn';

export interface NewMatchForm {
  name: string;
  config: typeof DEFAULT_CONFIG;
  rules: StreetCricketRules;
  teams: [
    { id: string; name: string; players: { id: string; name: string; teamId: string }[] },
    { id: string; name: string; players: { id: string; name: string; teamId: string }[] }
  ];
  toss: { winnerTeamId: string; choice: 'bat' | 'bowl' };
}

// Steps: Config → Teams → Toss → Review (rules folded into review)
const STEPS = ['Format', 'Teams', 'Toss', 'Start'];

// Compact step indicator with labels
function StepBar({ step }: { step: number }) {
  return (
    <div className="px-4 pt-3 pb-2">
      <div className="flex items-start gap-0">
        {STEPS.map((label, i) => {
          const done = i < step;
          const active = i === step;
          const last = i === STEPS.length - 1;
          return (
            <div key={i} className="flex-1 flex flex-col items-center">
              <div className="flex items-center w-full">
                <div className={cn(
                  'w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-black shrink-0 z-10 transition-all',
                  done  && 'bg-gold border-gold text-pitch',
                  active && 'bg-gold/20 border-gold text-gold',
                  !done && !active && 'bg-pitch-dark border-pitch-light text-muted',
                )}>
                  {done ? '✓' : i + 1}
                </div>
                {!last && (
                  <div className={cn(
                    'flex-1 h-0.5 transition-colors',
                    done ? 'bg-gold' : 'bg-pitch-light',
                  )} />
                )}
              </div>
              <p className={cn(
                'text-[9px] font-semibold mt-1 text-center leading-tight truncate w-full px-0.5',
                active ? 'text-gold' : done ? 'text-gold/60' : 'text-muted',
              )}>
                {label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Inline rules section (used inside Review step)
const ruleItems = [
  { key: 'lastManStands', label: 'Last Man Stands', desc: 'Final batsman bats alone' },
  { key: 'oneTipOneHand', label: 'One Tip One Hand', desc: '1-bounce 1-hand catch = out' },
  { key: 'noLBW', label: 'No LBW', desc: 'LBW not applicable' },
  { key: 'noByes', label: 'No Byes', desc: 'Byes not counted' },
  { key: 'retiredHurtAllowed', label: 'Retired Hurt', desc: 'Batsman can retire and return' },
] as const;

const FREE_HIT_OPTIONS: { value: FreeHitMode; label: string; desc: string }[] = [
  { value: 'none',                   label: 'Off',          desc: 'Manual only — tap the 🛡️ button' },
  { value: 'per_noball',             label: 'Per No Ball',  desc: 'Auto after every no-ball' },
  { value: 'two_consecutive_extras', label: '2 Extras Row', desc: 'Auto after 2 wides/no-balls in a row' },
];

function FreeHitSelector() {
  const { setValue, watch } = useFormContext<NewMatchForm>();
  const mode = (watch('rules.freeHitMode') ?? 'none') as FreeHitMode;
  return (
    <div className="py-2.5 border-b border-pitch-light/20">
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-semibold text-white text-sm">Free Hit Rule</p>
          <p className="text-xs text-muted">When to auto-grant free hits</p>
        </div>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-safe/15 text-safe border border-safe/30">
          {FREE_HIT_OPTIONS.find((o) => o.value === mode)?.label ?? 'Off'}
        </span>
      </div>
      <div className="flex gap-1.5">
        {FREE_HIT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setValue('rules.freeHitMode', opt.value)}
            className={cn(
              'flex-1 py-2 px-1 rounded-xl border text-center transition-all',
              mode === opt.value
                ? 'bg-safe/15 border-safe/50 text-safe'
                : 'bg-pitch-dark border-pitch-light/40 text-muted',
            )}
          >
            <p className="text-[11px] font-black leading-tight">{opt.label}</p>
          </button>
        ))}
      </div>
      <p className="text-[10px] text-muted/70 mt-1.5 leading-relaxed">
        {FREE_HIT_OPTIONS.find((o) => o.value === mode)?.desc}
        {' '}· Scorer can always grant manually with the 🛡️ button during play.
      </p>
    </div>
  );
}

function RulesAccordion() {
  const [open, setOpen] = useState(false);
  const { register, watch } = useFormContext<NewMatchForm>();
  const maxOvers = watch('rules.maxOversPerBowler');
  const freeHitMode = (watch('rules.freeHitMode') ?? 'none') as FreeHitMode;

  const activeRules = ruleItems.filter(({ key }) => watch(`rules.${key}`));
  const freeHitLabel = FREE_HIT_OPTIONS.find((o) => o.value === freeHitMode)?.label;
  const hasFreeHit = freeHitMode !== 'none';

  return (
    <div className="bg-pitch-light rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="text-left">
          <p className="text-sm font-semibold text-white">Advanced Rules</p>
          {(activeRules.length > 0 || hasFreeHit) ? (
            <div className="flex flex-wrap gap-1 mt-1">
              {activeRules.map((r) => (
                <span key={r.key} className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-gold/20 text-gold border border-gold/30">
                  {r.label}
                </span>
              ))}
              {hasFreeHit && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-safe/15 text-safe border border-safe/30">
                  🛡️ {freeHitLabel}
                </span>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted mt-0.5">Standard rules</p>
          )}
        </div>
        {open ? <ChevronUp size={16} className="text-muted" /> : <ChevronDown size={16} className="text-muted" />}
      </button>

      {open && (
        <div className="border-t border-pitch-light/30 px-4 py-3 space-y-1">
          {ruleItems.map(({ key, label, desc }) => (
            <label key={key} className="flex items-center justify-between py-2.5 border-b border-pitch-light/20 cursor-pointer last:border-0">
              <div>
                <p className="font-semibold text-white text-sm">{label}</p>
                <p className="text-xs text-muted">{desc}</p>
              </div>
              <div className="relative inline-flex items-center ml-3 shrink-0">
                <input {...register(`rules.${key}`)} type="checkbox" className="sr-only peer" />
                <div className="w-11 h-6 bg-pitch-dark rounded-full peer-checked:bg-gold transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:after:translate-x-5" />
              </div>
            </label>
          ))}

          {/* Free hit mode selector */}
          <FreeHitSelector />

          <div className="pt-2.5">
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold text-white text-sm">Max Overs / Bowler</p>
              <span className="text-gold font-bold text-sm">{maxOvers === 0 ? 'Unlimited' : maxOvers}</span>
            </div>
            <input
              {...register('rules.maxOversPerBowler', { valueAsNumber: true })}
              type="range" min={0} max={10} step={1}
              className="w-full accent-gold"
            />
            <p className="text-xs text-muted mt-1">0 = no restriction</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function SetupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const rematchTeams = (location.state as { rematch?: { teams: [Team, Team] } } | null)?.rematch?.teams;
  const { upsertMatch } = useMatch();
  const { addToast } = useUIStore();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [saveTeamA, setSaveTeamA] = useState(false);
  const [saveTeamB, setSaveTeamB] = useState(false);

  const teamAId = useRef(uuid()).current;
  const teamBId = useRef(uuid()).current;

  // Derive the player count from the rematch data so config stays consistent
  const rematchPlayerCount = rematchTeams
    ? Math.max(rematchTeams[0].players.length, rematchTeams[1].players.length)
    : DEFAULT_CONFIG.playersPerSide;

  const methods = useForm<NewMatchForm>({
    defaultValues: {
      name: '',
      config: {
        ...DEFAULT_CONFIG,
        // Match the original squad size so the scoring engine sees the right total
        playersPerSide: rematchTeams ? rematchPlayerCount : DEFAULT_CONFIG.playersPerSide,
      },
      rules: { ...DEFAULT_RULES, freeHitMode: 'none' as FreeHitMode },
      teams: rematchTeams
        ? [
            // Preserve original player IDs so career stats accumulate correctly
            { id: teamAId, name: rematchTeams[0].name, players: rematchTeams[0].players.map((p) => ({ id: p.id, name: p.name, teamId: teamAId })) },
            { id: teamBId, name: rematchTeams[1].name, players: rematchTeams[1].players.map((p) => ({ id: p.id, name: p.name, teamId: teamBId })) },
          ]
        : [
            { id: teamAId, name: 'Team A', players: [{ id: uuid(), name: '', teamId: teamAId }, { id: uuid(), name: '', teamId: teamAId }] },
            { id: teamBId, name: 'Team B', players: [{ id: uuid(), name: '', teamId: teamBId }, { id: uuid(), name: '', teamId: teamBId }] },
          ],
      toss: { winnerTeamId: '', choice: '' as 'bat' | 'bowl' },
    },
  });

  const { watch } = methods;
  const formValues = watch();
  const isSinglePlayer = watch('config.isSinglePlayerMode');

  const next = () => setStep((s) => {
    const n = Math.min(s + 1, STEPS.length - 1);
    // Skip Teams step (index 1) in single player mode
    return isSinglePlayer && n === 1 ? 2 : n;
  });
  const back = () => setStep((s) => {
    const n = Math.max(s - 1, 0);
    // Skip back over Teams step in single player mode
    return isSinglePlayer && n === 1 ? 0 : n;
  });

  const handleStart = async () => {
    setSubmitting(true);
    try {
      const values = methods.getValues();
      const playersPerSide = values.config.playersPerSide;

      const teams = values.teams.map((t, i) => {
        const teamId = i === 0 ? teamAId : teamBId;
        const resolvedPlayers = Array.from({ length: playersPerSide }, (_, pi) => {
          const existing = t.players[pi];
          return {
            id: existing?.id || uuid(),
            name: existing?.name?.trim() || `Player ${pi + 1}`,
            teamId,
          };
        });
        return {
          ...t,
          id: teamId,
          name: t.name?.trim() || `Team ${i === 0 ? 'A' : 'B'}`,
          players: resolvedPlayers,
        };
      }) as Match['teams'];

      const tossWinner = values.toss.winnerTeamId;
      const choice = values.toss.choice;
      const battingFirstId = choice === 'bat' ? tossWinner : (tossWinner === teamAId ? teamBId : teamAId);
      const bowlingFirstId = battingFirstId === teamAId ? teamBId : teamAId;

      const battingTeam = teams.find((t) => t.id === battingFirstId);
      if (!battingTeam) {
        addToast('Toss setup error. Please redo the toss step.', 'error');
        return;
      }

      const matchId = uuid();
      const inningsId = uuid();

      const innings: Innings = {
        id: inningsId,
        matchId,
        inningsNumber: 1,
        battingTeamId: battingFirstId,
        bowlingTeamId: bowlingFirstId,
        status: 'active',
        currentBatsmanIds: [battingTeam.players[0].id, battingTeam.players[1]?.id ?? null],
        strikerIndex: 0,
        currentBowlerId: null,
        battingOrder: [battingTeam.players[0].id, battingTeam.players[1].id],
      };

      const match: Match = {
        id: matchId,
        name: values.name?.trim() || autoMatchName(),
        createdAt: Date.now(),
        status: 'innings_1',
        config: { ...values.config },
        rules: { ...values.rules },
        toss: { winnerTeamId: tossWinner, choice },
        teams,
        inningsIds: [inningsId],
      };

      await upsertMatch(match);
      await saveInnings(innings);

      if (saveTeamA || saveTeamB) {
        const existingTeams = await getAllSavedTeams();
        const existingNames = new Set(existingTeams.map((t) => t.name.toLowerCase().trim()));
        for (let i = 0; i < 2; i++) {
          const shouldSave = i === 0 ? saveTeamA : saveTeamB;
          if (!shouldSave) continue;
          const t = teams[i];
          if (existingNames.has(t.name.toLowerCase().trim())) continue;
          const saved: SavedTeam = {
            id: uuid(),
            name: t.name,
            players: t.players.map((p) => ({ id: uuid(), name: p.name })),
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          await saveSavedTeam(saved);
        }
      }

      navigate(`/match/${matchId}/scoring`);
    } catch (err) {
      addToast('Failed to create match. Please try again.', 'error');
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-pitch flex flex-col">
      <TopBar title="New Match" showBack onBack={() => navigate('/')} />
      <StepBar step={step} />

      <div className="flex-1 px-4 pb-8 overflow-y-auto">
        <FormProvider {...methods}>
          {step === 0 && <MatchConfigStep onNext={next} />}
          {step === 1 && <TeamsStep onNext={next} onBack={back} />}
          {step === 2 && <TossStep onNext={next} onBack={back} />}
          {step === 3 && (
            <div className="space-y-4">
              {/* Premium match preview card */}
              <div className="relative overflow-hidden rounded-2xl bg-pitch-light border border-white/5 edge-lit">
                <div className="h-[3px] bg-gradient-to-r from-gold/60 via-gold to-gold/60" />
                <div className="p-4">
                  {/* Match name */}
                  <p className="text-[10px] text-muted font-black uppercase tracking-widest text-center mb-3">
                    {formValues.name?.trim() || autoMatchName()}
                  </p>
                  {/* Teams VS */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="flex-1 bg-pitch-dark rounded-xl py-3 px-3 text-center border border-pitch-light/40">
                      <p className="text-white font-black text-sm truncate">{formValues.teams[0].name || 'Team A'}</p>
                    </div>
                    <span className="font-display text-xl text-gold shrink-0">VS</span>
                    <div className="flex-1 bg-pitch-dark rounded-xl py-3 px-3 text-center border border-pitch-light/40">
                      <p className="text-white font-black text-sm truncate">{formValues.teams[1].name || 'Team B'}</p>
                    </div>
                  </div>
                  {/* Format badges */}
                  <div className="flex flex-wrap justify-center gap-2 mb-3">
                    <span className="px-3 py-1 rounded-full bg-gold/15 border border-gold/30 text-gold text-[11px] font-bold">
                      {formValues.config.overs} overs
                    </span>
                    <span className="px-3 py-1 rounded-full bg-pitch-dark border border-pitch-light text-muted text-[11px] font-bold">
                      {formValues.config.playersPerSide} players
                    </span>
                    <span className="px-3 py-1 rounded-full bg-pitch-dark border border-pitch-light text-muted text-[11px] font-bold capitalize">
                      {formValues.config.ballType} ball
                    </span>
                  </div>
                  {/* Toss result */}
                  {(() => {
                    const winner = formValues.teams.find((t) => t.id === formValues.toss.winnerTeamId);
                    const batFirst = formValues.toss.choice === 'bat' ? winner : formValues.teams.find((t) => t.id !== formValues.toss.winnerTeamId);
                    return (
                      <p className="text-center text-[11px] text-muted">
                        <span className="text-white font-semibold">{batFirst?.name ?? '?'}</span>
                        {' '}<span className="text-gold font-bold">batting first</span>
                      </p>
                    );
                  })()}
                </div>
              </div>

              {/* Rules — collapsible accordion */}
              <RulesAccordion />

              {/* Save to My Teams */}
              {!formValues.config.isSinglePlayerMode && (
                <div className="bg-pitch-light rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 mb-1">
                    <BookmarkPlus size={15} className="text-gold" />
                    <p className="text-sm font-semibold text-white">Save to My Teams</p>
                    <p className="text-xs text-muted ml-auto">reuse next match</p>
                  </div>
                  {([0, 1] as const).map((i) => {
                    const checked = i === 0 ? saveTeamA : saveTeamB;
                    const setChecked = i === 0 ? setSaveTeamA : setSaveTeamB;
                    const name = formValues.teams[i].name || `Team ${i === 0 ? 'A' : 'B'}`;
                    return (
                      <label key={i} className="flex items-center gap-3 cursor-pointer">
                        <div
                          onClick={() => setChecked(!checked)}
                          className={cn(
                            'w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all',
                            checked ? 'bg-gold border-gold' : 'border-muted/50',
                          )}
                        >
                          {checked && (
                            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                              <path d="M2 6l3 3 5-5" stroke="#111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          )}
                        </div>
                        <span className="text-sm text-white font-medium">{name}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-3">
                <Button variant="secondary" size="lg" fullWidth onClick={back}>← Back</Button>
                <Button variant="gold" size="xl" fullWidth loading={submitting} onClick={handleStart}>
                  🏏 Start Match
                </Button>
              </div>
            </div>
          )}
        </FormProvider>
      </div>
    </div>
  );
}
