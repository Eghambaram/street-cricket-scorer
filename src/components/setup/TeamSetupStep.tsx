import { useEffect, useState } from 'react';
import { useFormContext, useFieldArray } from 'react-hook-form';
import { Plus, Trash2, Users, PencilLine, Check } from 'lucide-react';
import type { NewMatchForm } from '@/pages/SetupPage';
import { Button } from '@/components/common/Button';
import { useTeams } from '@/hooks/useTeams';
import { cn } from '@/utils/cn';
import type { SavedTeam } from '@/types/player.types';

interface Props {
  teamIndex: 0 | 1;
  onNext: () => void;
  onBack: () => void;
}

type Mode = 'saved' | 'manual';

export function TeamSetupStep({ teamIndex, onNext, onBack }: Props) {
  const { register, control, watch, setValue } = useFormContext<NewMatchForm>();
  const fieldPath = `teams.${teamIndex}.players` as const;
  const { fields, append, remove, replace } = useFieldArray({ control, name: fieldPath });
  const isSingle = watch('config.isSinglePlayerMode');
  const playersPerSide = watch('config.playersPerSide');

  const { teams, loadTeams } = useTeams();
  const [mode, setMode] = useState<Mode>('manual');
  const [selectedSavedTeam, setSelectedSavedTeam] = useState<SavedTeam | null>(null);
  // selectedPlayerIds = which players from the saved team are checked for this match
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<Set<string>>(new Set());

  useEffect(() => { loadTeams(); }, [loadTeams]);

  // Auto-switch to saved mode if teams exist
  useEffect(() => {
    if (teams.length > 0 && mode === 'manual' && !selectedSavedTeam) {
      setMode('saved');
    }
  }, [teams.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const addPlayer = () => {
    if (fields.length < playersPerSide) {
      append({ id: crypto.randomUUID(), name: '', teamId: '' });
    }
  };

  const handleSelectSavedTeam = (team: SavedTeam) => {
    setSelectedSavedTeam(team);
    // Pre-select all players
    setSelectedPlayerIds(new Set(team.players.map((p) => p.id)));
  };

  const togglePlayer = (playerId: string) => {
    setSelectedPlayerIds((prev) => {
      const next = new Set(prev);
      if (next.has(playerId)) {
        next.delete(playerId);
      } else {
        next.add(playerId);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (!selectedSavedTeam) return;
    setSelectedPlayerIds(new Set(selectedSavedTeam.players.map((p) => p.id)));
  };

  const handleUseSavedTeam = () => {
    if (!selectedSavedTeam) return;
    const teamId = watch(`teams.${teamIndex}.id`);
    const selectedPlayers = selectedSavedTeam.players
      .filter((p) => selectedPlayerIds.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, teamId }));

    setValue(`teams.${teamIndex}.name`, selectedSavedTeam.name);
    replace(selectedPlayers);
    onNext();
  };

  const canProceedSaved =
    selectedSavedTeam !== null && selectedPlayerIds.size >= 2;

  const label = teamIndex === 0 ? 'Team A' : 'Team B';

  return (
    <div className="space-y-4">
      {/* Mode toggle — only show if saved teams exist */}
      {teams.length > 0 && !isSingle && (
        <div className="flex rounded-xl overflow-hidden border border-pitch-light">
          <button
            onClick={() => setMode('saved')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors',
              mode === 'saved' ? 'bg-gold text-pitch' : 'bg-pitch-light text-muted hover:text-white',
            )}
          >
            <Users size={15} />
            Saved Team
          </button>
          <button
            onClick={() => setMode('manual')}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-semibold transition-colors',
              mode === 'manual' ? 'bg-gold text-pitch' : 'bg-pitch-light text-muted hover:text-white',
            )}
          >
            <PencilLine size={15} />
            Enter Manually
          </button>
        </div>
      )}

      {/* ── Saved team mode ── */}
      {mode === 'saved' && !isSingle && (
        <>
          {!selectedSavedTeam ? (
            /* Step 1: pick a saved team */
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted">Choose {label}</p>
              {teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => handleSelectSavedTeam(team)}
                  className="w-full flex items-center gap-3 bg-pitch-dark border border-pitch-light rounded-xl px-4 py-3 hover:border-gold/50 hover:bg-pitch-light/30 transition-all text-left"
                >
                  <div className="w-9 h-9 rounded-xl bg-gold/15 flex items-center justify-center flex-shrink-0">
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
          ) : (
            /* Step 2: pick squad from that team */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-bold">{selectedSavedTeam.name}</p>
                  <p className="text-muted text-xs">
                    {selectedPlayerIds.size} selected
                    {selectedPlayerIds.size < 2 && (
                      <span className="text-wicket ml-1">— need at least 2</span>
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAll}
                    className="text-gold text-xs font-semibold hover:text-gold-light"
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

              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {selectedSavedTeam.players.map((player) => {
                  const checked = selectedPlayerIds.has(player.id);
                  return (
                    <button
                      key={player.id}
                      onClick={() => togglePlayer(player.id)}
                      className={cn(
                        'w-full flex items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all',
                        checked
                          ? 'bg-gold/15 border border-gold/30'
                          : 'bg-pitch-dark border border-pitch-light hover:border-pitch',
                      )}
                    >
                      <div
                        className={cn(
                          'w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all',
                          checked ? 'bg-gold border-gold' : 'border-muted/50',
                        )}
                      >
                        {checked && <Check size={12} className="text-pitch" strokeWidth={3} />}
                      </div>
                      <span className={cn('flex-1 text-sm font-medium truncate', checked ? 'text-white' : 'text-muted')}>
                        {player.name}
                      </span>
                      {player.role && (
                        <span className={cn('text-xs font-bold px-1.5 py-0.5 rounded flex-shrink-0',
                          checked ? 'text-gold bg-gold/20' : 'text-muted/50 bg-pitch',
                        )}>
                          {player.role === 'wicketkeeper' ? 'WK' : player.role === 'allrounder' ? 'AR' : player.role.slice(0, 4).toUpperCase()}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="flex gap-3 pt-1">
                <Button variant="secondary" size="lg" fullWidth onClick={onBack}>← Back</Button>
                <Button
                  variant="gold"
                  size="lg"
                  fullWidth
                  disabled={!canProceedSaved}
                  onClick={handleUseSavedTeam}
                >
                  {teamIndex === 0 ? 'Next: Team B →' : 'Next: Toss →'}
                </Button>
              </div>
            </div>
          )}

          {/* Back button when no team picked yet */}
          {!selectedSavedTeam && (
            <div className="flex gap-3 pt-1">
              <Button variant="secondary" size="lg" fullWidth onClick={onBack}>← Back</Button>
            </div>
          )}
        </>
      )}

      {/* ── Manual entry mode ── */}
      {(mode === 'manual' || isSingle) && (
        <>
          <div>
            <label className="block text-sm font-semibold text-muted mb-1">
              {label} Name
            </label>
            <input
              {...register(`teams.${teamIndex}.name`)}
              placeholder={`Team ${teamIndex === 0 ? 'A' : 'B'}`}
              className="w-full bg-pitch-dark border border-pitch-light rounded-xl px-4 py-3 text-white placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-gold/50"
            />
          </div>

          {isSingle ? (
            <div className="bg-pitch-dark rounded-xl p-4 text-center border border-pitch-light">
              <p className="text-muted text-sm">Single player mode</p>
              <p className="text-white font-semibold text-sm mt-1">
                Players will be auto-named Player 1 – Player {playersPerSide}
              </p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-muted">Players ({fields.length}/{playersPerSide})</p>
                  {fields.length < playersPerSide && (
                    <button onClick={addPlayer} className="flex items-center gap-1 text-gold text-sm font-semibold">
                      <Plus size={16} /> Add Player
                    </button>
                  )}
                </div>
                {fields.map((field, i) => (
                  <div key={field.id} className="flex items-center gap-2">
                    <span className="text-muted text-sm w-5 text-right">{i + 1}.</span>
                    <input
                      {...register(`teams.${teamIndex}.players.${i}.name`)}
                      placeholder={`Player ${i + 1}`}
                      className="flex-1 bg-pitch-dark border border-pitch-light rounded-xl px-3 py-2.5 text-white placeholder-muted/50 focus:outline-none focus:ring-2 focus:ring-gold/50"
                    />
                    {fields.length > 2 && (
                      <button onClick={() => remove(i)} className="text-muted hover:text-wicket p-1">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {fields.length < 2 && (
                <p className="text-wicket text-xs">Minimum 2 players required</p>
              )}
            </>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" size="lg" fullWidth onClick={onBack}>← Back</Button>
            <Button variant="gold" size="lg" fullWidth onClick={onNext}>
              {teamIndex === 0 ? 'Next: Team B →' : 'Next: Toss →'}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
