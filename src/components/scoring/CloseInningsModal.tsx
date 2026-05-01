import { Flag, Ban } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Button } from '@/components/common/Button';
import { cn } from '@/utils/cn';

interface Props {
  isOpen: boolean;
  inningsNumber: 1 | 2;
  currentScore: string;
  onConfirm: (reason: 'declared' | 'abandoned') => void;
  onClose: () => void;
}

export function CloseInningsModal({ isOpen, inningsNumber, currentScore, onConfirm, onClose }: Props) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Close Innings Early">
      <div className="bg-pitch rounded-xl px-4 py-3 mb-5 text-center">
        <p className="text-muted text-xs font-semibold mb-0.5">
          Innings {inningsNumber} — Current Score
        </p>
        <p className="text-white font-black text-2xl">{currentScore}</p>
      </div>

      <div className="space-y-3 mb-5">
        {/* Declare — only meaningful for innings 1 */}
        <OptionButton
          icon={<Flag size={20} />}
          label="Declare"
          description={
            inningsNumber === 1
              ? 'End this innings and start the 2nd innings immediately'
              : 'Close this innings and calculate the result now'
          }
          colorClass="border-gold/40 hover:border-gold hover:bg-gold/10 text-gold"
          onClick={() => onConfirm('declared')}
        />

        {/* Abandon */}
        <OptionButton
          icon={<Ban size={20} />}
          label="Abandon Match"
          description="End the entire match with no result recorded"
          colorClass="border-wicket/40 hover:border-wicket hover:bg-wicket/10 text-wicket"
          onClick={() => onConfirm('abandoned')}
        />
      </div>

      <p className="text-muted text-xs text-center mb-4">This cannot be undone.</p>

      <Button variant="secondary" size="lg" fullWidth onClick={onClose}>
        Cancel
      </Button>
    </Modal>
  );
}

function OptionButton({
  icon,
  label,
  description,
  colorClass,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  colorClass: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-start gap-4 rounded-xl px-4 py-4 border transition-all text-left min-h-[72px]',
        'bg-pitch-dark',
        colorClass,
      )}
    >
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <div>
        <p className="font-bold text-sm">{label}</p>
        <p className="text-muted text-xs mt-0.5 leading-snug">{description}</p>
      </div>
    </button>
  );
}
