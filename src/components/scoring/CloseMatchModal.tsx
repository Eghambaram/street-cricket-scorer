import { useState } from 'react';
import { Trophy, Minus } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { cn } from '@/utils/cn';
import type { Team } from '@/types/match.types';

interface Props {
  isOpen: boolean;
  teams: [Team, Team];
  onConfirm: (winnerId: string | null) => void;
  onClose: () => void;
}

export function CloseMatchModal({ isOpen, teams, onConfirm, onClose }: Props) {
  // null = no result selected yet; empty string = No Result chosen
  const [selected, setSelected] = useState<string | null>(null);

  const handleClose = () => {
    setSelected(null);
    onClose();
  };

  const handleConfirm = () => {
    if (selected === null) return;
    // empty string means "No Result"
    onConfirm(selected === '' ? null : selected);
    setSelected(null);
  };

  const options: { id: string; label: string; sub: string }[] = [
    { id: teams[0].id, label: teams[0].name, sub: 'wins the match' },
    { id: teams[1].id, label: teams[1].name, sub: 'wins the match' },
    { id: '',          label: 'No Result',   sub: 'match abandoned' },
  ];

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="End Match">
      <p className="text-muted text-sm text-center mb-5">
        Select the outcome. This will end the match immediately.
      </p>

      <div className="space-y-2 mb-5">
        {options.map((opt) => {
          const isNoResult = opt.id === '';
          const isActive = selected === opt.id;
          return (
            <button
              key={opt.id || 'no-result'}
              onClick={() => setSelected(opt.id)}
              className={cn(
                'w-full flex items-center gap-4 rounded-xl px-4 py-3.5 border transition-all text-left min-h-[64px]',
                isActive
                  ? isNoResult
                    ? 'bg-muted/20 border-muted text-white'
                    : 'bg-gold/15 border-gold text-white'
                  : 'bg-pitch-dark border-pitch-light hover:border-pitch text-muted',
              )}
            >
              <span className={cn(
                'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                isActive
                  ? isNoResult ? 'bg-muted/30' : 'bg-gold/30'
                  : 'bg-pitch',
              )}>
                {isNoResult
                  ? <Minus size={16} className={isActive ? 'text-white' : 'text-muted'} />
                  : <Trophy size={16} className={isActive ? 'text-gold' : 'text-muted'} />
                }
              </span>
              <div>
                <p className={cn('font-bold text-sm', isActive ? 'text-white' : 'text-muted')}>
                  {opt.label}
                </p>
                <p className="text-xs text-muted mt-0.5">{opt.sub}</p>
              </div>
            </button>
          );
        })}
      </div>

      <p className="text-muted text-xs text-center mb-4">This cannot be undone.</p>

      <div className="flex gap-3">
        <Button variant="secondary" size="lg" fullWidth onClick={handleClose}>
          Cancel
        </Button>
        <Button
          variant="danger"
          size="lg"
          fullWidth
          disabled={selected === null}
          onClick={handleConfirm}
        >
          End Match
        </Button>
      </div>
    </Modal>
  );
}
