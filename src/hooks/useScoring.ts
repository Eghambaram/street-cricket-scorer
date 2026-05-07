import { useScoringStore, type ScoreParams } from '@/store/scoringStore';
import { useUIStore } from '@/store/uiStore';
import type { Innings } from '@/types/match.types';

export function useScoring() {
  const store = useScoringStore();
  const { addToast, triggerBoundaryFlash, triggerWicketFlash, triggerScoreFlash } = useUIStore();

  const score = async (params: ScoreParams) => {
    try {
      const result = await store.scoreDelivery(params);
      // Visual feedback
      if (params.runs === 4) triggerBoundaryFlash('four');
      if (params.runs === 6) triggerBoundaryFlash('six');
      if (params.wicket) triggerWicketFlash();
      // Pulse the scoreboard on every legal delivery
      const isLegal = !params.extras.wide && !params.extras.noBall;
      if (isLegal) triggerScoreFlash();
      return result;
    } catch (err) {
      addToast('Failed to record delivery. Please try again.', 'error');
      throw err;
    }
  };

  const undo = async () => {
    try {
      await store.undoLastDelivery();
      addToast('Last delivery undone', 'info');
    } catch {
      addToast('Nothing to undo', 'warning');
    }
  };

  const selectNextBatsman = (inningsState: Innings, nextBatsmanId: string): Innings => {
    // Put next batsman at the vacant slot. The incoming player may be brand new,
    // a tap-and-changed batsman who is already in battingOrder, or a retired-hurt
    // batsman being recalled.
    const [a, b] = inningsState.currentBatsmanIds;
    const battingOrder = inningsState.battingOrder.includes(nextBatsmanId)
      ? inningsState.battingOrder
      : [...inningsState.battingOrder, nextBatsmanId];
    const retiredHurtIds = (inningsState.retiredHurtIds ?? []).filter((id) => id !== nextBatsmanId);

    if (!a || a === '') {
      return { ...inningsState, currentBatsmanIds: [nextBatsmanId, b], battingOrder, retiredHurtIds };
    }

    return { ...inningsState, currentBatsmanIds: [a, nextBatsmanId], battingOrder, retiredHurtIds };
  };

  return {
    match: store.match,
    innings: store.innings,
    deliveries: store.deliveries,
    stats: store.stats,
    lastDelivery: store.lastDelivery,
    loadInnings: store.loadInnings,
    finaliseInnings: store.finaliseInnings,
    rotateStrike: store.rotateStrike,
    changeBatsman: store.changeBatsman,
    changeBowler: store.changeBowler,
    retireHurt: store.retireHurt,
    recallRetiredBatsman: store.recallRetiredBatsman,
    toggleFreeHit: store.toggleFreeHit,
    clear: store.clear,
    score,
    undo,
    selectNextBatsman,
  };
}
