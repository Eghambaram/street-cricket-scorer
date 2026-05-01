import { useState, useEffect, useRef } from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { Plus, Trash2, Users, PencilLine, Check } from 'lucide-react';
import type { NewMatchForm } from '@/pages/SetupPage';
import { Button } from '@/components/common/Button';
import { cn } from '@/utils/cn';
import type { SavedTeam } from '@/types/player.types';
import { getAllSavedTeams } from '@/db/repos/savedTeamRepo';
import { useTeams } from '@/hooks/useTeams';

interface Props {
  onNext: () => void;
  onBack: () => void;
}

// ── Per-team form panel ──────────────────────────────────────────────────────

function TeamForm({ teamIndex, recentNames }: { teamIndex: 0 | 1; recentNames: string[] }) {
  const { register, control, watch, setValue } = useFormContext<NewMatchForm>();
  const fieldPath = `teams.${teamIndex}.players` as const;
  const { fields, append, remove, replace } = useFieldArray({ control, name: fieldPath });
  const isSingle = watch('config.isSinglePlayerMode');
  const playersPerSide = watch('config.playersPerSide');
  const teamId = watch(`teams.${teamIndex}.id`);
  const label = teamIndex === 0 ? 'Team A' : 'Team B';

  const { teams, loadTeams } = useTeams();
  const [mode, setMode] = useState<'saved' | 'manual'>('manual');
  const [selectedSavedTeam, setSelectedSavedTeam] = useState<SavedTeam | null>(null);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => { loadTeams(); }, [loadTeams]);

  // Auto-switch to saved mode only when no players are already filled in (i.e. not a rematch/prefill)
  const currentPlayers = watch(`teams.${teamIndex}.players`);
  const hasPrefilledData = currentPlayers?.some((p) => p.name?.trim());
  useEffect(() => {
    if (teams.length > 0 && mode === 'manual' && !selectedSavedTeam && !hasPrefilledData) {
      setMode('saved');
    }
  }, [teams.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSelectSavedTeam = (team: SavedTeam) => {
    setSelectedSavedTeam(team);
    setSelectedPlayerIds(new Set(team.players.map((p) => p.id)));
  };

  const togglePlayer = (playerId: string) => {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      next.has(playerId) ? next.delete(playerId) : next.add(playerId);
      return next;
    });
  };

  const applySelectedTeam = () => {
    if (!selectedSavedTeam) return;
    const selected = selectedSavedTeam.players
      .filter((p) => selectedPlayerIds.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, teamId }));
    setValue(`teams.${teamIndex}.name`, selectedSavedTeam.name);
    replace(selected);
    // Drop back to the field view so user can see the result
    setMode('manual');
  };

  // Recent name chips — exclude names already in use
  const currentNames = fields.map((_, i) => watch(`teams.${teamIndex}.players.${i}.name`) ?? '');
  const usedNames = new Set(currentNames.filter(Boolean));
  const chips = recentNames.filter((n) => !usedNames.has(n));

  const addFromChip = (name: string) => {
    const emptyIdx = currentNames.findIndex((n) => !n?.trim());
    if (emptyIdx >= 0) {
      setValue(`teams.${teamIndex}.players.${emptyIdx}.name`, name);
    } else if (fields.length < playersPerSide) {
      append({ id: crypto.randomUUID(), name, teamId });
    }
  };

  // ── Saved mode ──
  if (mode === 'saved' && !isSingle) {
    if (!selectedSavedTeam) {
      return (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted mb-2">Select saved team for {label}</p>
          {teams.map((team) => (
            <button
              key={team.id}
              onClick={() => handleSelectSavedTeam(team)}
              className="w-full flex items-center gap-3 bg-pitch-dark border border-pitch-light rounded-xl px-4 py-3 hover:border-gold/50 transition-all text-left"
            >
              <div className="w-9 h-9 rounded-xl bg-gold/15 flex items-center justify-center shrink-0">
                <Users size={16} className="text-gold" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold truncate">{team.name}</p>
                <p className="text-muted text-xs">{team.players.length} players</p>
              </div>
            </button>
          ))}
          <button
            onClick={() => setMode('manual')}
            className="w-full text-center text-muted text-sm py-2 hover:text-white transition-colors"
          >
            + Enter a new team manually
          </button>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white font-bold">{selectedSavedTeam.name}</p>
            <p className="text-muted text-xs">
              {selectedPlayerIds.size} selected
              {selectedPlayerIds.size < 2 && <span className="text-wicket ml-1">— need at least 2</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSelectedPlayerIds(new Set(selectedSavedTeam.players.map((p) => p.id)))}
              className="text-gold text-xs font-semibold"
            >
              All
            </button>
            <button
              onClick={() => { setSelectedSavedTeam(null); setSelectedPlayerIds(new Set()); }}
              className="text-muted text-xs hover:text-white"
            >
              Change
            </button>
          </div>
        </div>

        <div className="space-y-1.5 max-h-56 overflow-y-auto">
          {selectedSavedTeam.players.map((player) => {
            const checked = selectedPlayerIds.has(player.id);
            return (
              <button
                key={player.id}
                onClick={() => togglePlayer(player.id)}
                className={cn(
                  'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all',
                  checked ? 'bg-gold/15 border border-gold/30' : 'bg-pitch-dark border border-pitch-light',
                )}
              >
                <div className={cn('w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all', checked ? 'bg-gold border-gold' : 'border-muted/50')}>
                  {checked && <Check size={12} className="text-pitch" strokeWidth={3} />}
                </div>
                <span className={cn('flex-1 text-sm font-medium truncate', checked ? 'text-white' : 'text-muted')}>
                  {player.name}
                </span>
              </button>
            );
          })}
        </div>

        <Button
          variant="gold"
          size="md"
          fullWidth
          disabled={selectedPlayerIds.size < 2}
          onClick={applySelectedTeam}
        >
          Use these {selectedPlayerIds.size} players ✓
        </Button>
      </div>
    );
  }

  // ── Manual mode ──
  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      {teams.length > 0 && !isSingle && (
        <div className="flex rounded-xl overflow-hidden border border-pitch-light">
          <button
            onClick={() => setMode('saved')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors',
              mode === 'saved' ? 'bg-gold text-pitch' : 'bg-pitch-light text-muted hover:text-white',
            )}
          >
            <Users size={13} /> Saved Team
          </button>
          <button
            onClick={() => setMode('manual')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-semibold transition-colors',
              mode === 'manual' ? 'bg-gold text-pitch' : 'bg-pitch-light text-muted hover:text-white',
            )}
          >
            <PencilLine size={13} /> Enter Manually
          </button>
        </div>
      )}

      {/* Team name */}
      <input
        {...register(`teams.${teamIndex}.name`)}
        placeholder={`${label} name`}
        className="w-full bg-pitch-dark border border-pitch-light rounded-xl px-4 py-3 text-white placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-gold/50"
      />

      {isSingle ? (
        <div className="bg-pitch-dark rounded-xl p-4 text-center border border-pitch-light">
          <p className="text-muted text-sm">Players will be auto-named Player 1 – Player {playersPerSide}</p>
        </div>
      ) : (
        <>
          {/* Recent player chips */}
          {chips.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-1.5">
                Recent players — tap to add
              </p>
              <div className="flex flex-wrap gap-1.5">
                {chips.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => addFromChip(name)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-pitch-dark border border-pitch-light text-muted hover:text-white hover:border-gold/50 active:scale-95 transition-all"
                  >
                    + {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Player inputs */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-muted">Players ({fields.length}/{playersPerSide})</p>
              {fields.length < playersPerSide && (
                <button type="button" onClick={() => append({ id: crypto.randomUUID(), name: '', teamId })} className="flex items-center gap-1 text-gold text-xs font-semibold">
                  <Plus size={14} /> Add
                </button>
              )}
            </div>
            {fields.map((field, i) => {
              const { ref: rhfRef, ...rest } = register(`teams.${teamIndex}.players.${i}.name`);
              return (
                <div key={field.id} className="flex items-center gap-2">
                  <span className="text-muted text-xs w-5 text-right shrink-0">{i + 1}.</span>
                  <input
                    {...rest}
                    ref={(el) => { rhfRef(el); inputRefs.current[i] = el; }}
                    placeholder={`Player ${i + 1}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        if (i < fields.length - 1) {
                          inputRefs.current[i + 1]?.focus();
                        } else if (fields.length < playersPerSide) {
                          append({ id: crypto.randomUUID(), name: '', teamId });
                          setTimeout(() => inputRefs.current[fields.length]?.focus(), 50);
                        }
                      }
                    }}
                    className="flex-1 bg-pitch-dark border border-pitch-light rounded-xl px-3 py-2.5 text-white placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-gold/50 text-sm"
                  />
                  {fields.length > 2 && (
                    <button type="button" onClick={() => remove(i)} className="text-muted hover:text-wicket p-1 shrink-0">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {fields.length < 2
            ? <p className="text-wicket text-xs">Minimum 2 players required</p>
            : fields.filter((_, i) => !currentNames[i]?.trim()).length > 0 && fields.filter((_, i) => currentNames[i]?.trim()).length < 2
            ? <p className="text-wicket text-xs">Enter at least 2 player names to continue</p>
            : null
          }
        </>
      )}
    </div>
  );
}

// ── Main combined step ───────────────────────────────────────────────────────

export function TeamsStep({ onNext, onBack }: Props) {
  const [activeTab, setActiveTab] = useState<0 | 1>(0);
  const [recentNames, setRecentNames] = useState<string[]>([]);
  const { watch } = useFormContext<NewMatchForm>();

  useEffect(() => {
    getAllSavedTeams().then((savedTeams) => {
      const names = [
        ...new Set(savedTeams.flatMap((t) => t.players.map((p) => p.name)).filter(Boolean)),
      ];
      setRecentNames(names.slice(0, 15));
    });
  }, []);

  const teams = watch('teams');
  const isSingle = watch('config.isSinglePlayerMode');

  const teamValid = (idx: 0 | 1) => {
    const t = teams[idx];
    if (!t.name?.trim()) return false;
    if (isSingle) return true;
    const filled = t.players.filter((p) => p.name?.trim());
    return filled.length >= 2;
  };

  const canProceed = teamValid(0) && teamValid(1);

  return (
    <div className="space-y-4">
      {/* Team tab switcher */}
      <div className="flex rounded-xl overflow-hidden border border-pitch-light">
        {([0, 1] as const).map((i) => (
          <button
            key={i}
            type="button"
            onClick={() => setActiveTab(i)}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors',
              activeTab === i ? 'bg-gold text-pitch' : 'bg-pitch-light text-muted hover:text-white',
            )}
          >
            {teamValid(i) && <Check size={13} strokeWidth={3} />}
            {teams[i].name?.trim() || `Team ${i === 0 ? 'A' : 'B'}`}
          </button>
        ))}
      </div>

      {/* Active team form */}
      <TeamForm teamIndex={activeTab} recentNames={recentNames} />

      {/* Validation hint */}
      {activeTab === 1 && !canProceed && !watch('config.isSinglePlayerMode') && (
        <p className="text-wicket text-xs text-center -mt-1">
          {!teams[0].name?.trim() || !teams[1].name?.trim()
            ? 'Both teams need a name'
            : 'Each team needs at least 2 player names'}
        </p>
      )}

      {/* Navigation */}
      <div className="flex gap-3 pt-2">
        <Button variant="secondary" size="lg" fullWidth onClick={onBack}>← Back</Button>
        {activeTab === 0 ? (
          <Button
            variant="gold"
            size="lg"
            fullWidth
            onClick={() => setActiveTab(1)}
          >
            Team B →
          </Button>
        ) : (
          <Button
            variant="gold"
            size="lg"
            fullWidth
            disabled={!canProceed}
            onClick={onNext}
          >
            Next: Toss →
          </Button>
        )}
      </div>
    </div>
  );
}
