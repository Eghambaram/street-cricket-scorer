import { create } from 'zustand';
import { v4 as uuid } from 'uuid';
import type { Match, Innings } from '@/types/match.types';
import type { Delivery, InningsStats } from '@/types/delivery.types';
import type { Wicket } from '@/types/delivery.types';
import { saveInnings } from '@/db/repos/inningsRepo';
import {
  getInningsDeliveries,
  addDelivery,
  deleteLastDelivery,
} from '@/db/repos/playerRepo';
import {
  computeInningsStats,
  computeNextStrikerIndex,
  isLegalDelivery,
} from '@/utils/cricket';
import { getFreeHitMode } from '@/types/rules.types';

interface ScoringState {
  match: Match | null;
  innings: Innings | null;
  deliveries: Delivery[];
  stats: InningsStats | null;
  lastDelivery: Delivery | null;

  loadInnings: (match: Match, innings: Innings) => Promise<void>;
  scoreDelivery: (params: ScoreParams) => Promise<DeliveryResult>;
  undoLastDelivery: () => Promise<void>;
  finaliseInnings: (reason: Innings['completedReason']) => Promise<void>;
  rotateStrike: () => Promise<void>;
  changeBatsman: (position: 0 | 1, newPlayerId: string) => Promise<void>;
  changeBowler: (newBowlerId: string) => Promise<void>;
  retireHurt: (batsmanId: string, nextBatsmanId: string | null) => Promise<void>;
  recallRetiredBatsman: (batsmanId: string, position: 0 | 1) => Promise<void>;
  toggleFreeHit: () => Promise<void>;
  clear: () => void;
}

export interface ScoreParams {
  runs: number;
  extras: Delivery['extras'];
  wicket?: Wicket;
}

export interface DeliveryResult {
  delivery: Delivery;
  isOverComplete: boolean;
  isInningsOver: boolean;
  newStats: InningsStats;
}

export const useScoringStore = create<ScoringState>((set, get) => ({
  match: null,
  innings: null,
  deliveries: [],
  stats: null,
  lastDelivery: null,

  loadInnings: async (match, innings) => {
    const deliveries = await getInningsDeliveries(innings.id);
    const allPlayers = match.teams.flatMap((t) => t.players);
    const nameOf = (id: string) => allPlayers.find((p) => p.id === id)?.name ?? id;
    const stats = computeInningsStats(deliveries, nameOf);
    set({ match, innings, deliveries, stats, lastDelivery: deliveries[deliveries.length - 1] ?? null });
  },

  scoreDelivery: async ({ runs, extras, wicket }) => {
    const { match, innings, deliveries } = get();
    if (!match || !innings) throw new Error('No active innings');

    const allPlayers = match.teams.flatMap((t) => t.players);
    const nameOf = (id: string) => allPlayers.find((p) => p.id === id)?.name ?? id;

    const isWide = extras.wide > 0;
    const isNoBall = extras.noBall > 0;
    const isLegal = !isWide && !isNoBall;
    const isExtra = isWide || isNoBall;
    // Free hit is active when freeHitPending is true; it is only consumed on a legal delivery.
    // A wide or no-ball on a free-hit ball keeps the free hit alive.
    const isFreeHit = !!(innings.freeHitPending && !isNoBall);

    // Derive over/ball position from current stats
    const currentStats = computeInningsStats(deliveries);
    const overIndex  = currentStats.overs;  // # completed overs = current over index
    const ballIndex  = currentStats.balls;  // legal balls bowled in current over (0-5)
    const deliverySequence = deliveries.length;

    const totalRuns = runs + extras.wide + extras.noBall + extras.bye + extras.legBye;

    const delivery: Delivery = {
      id: uuid(),
      inningsId: innings.id,
      overIndex,
      ballIndex,
      deliverySequence,
      batsmanId: innings.currentBatsmanIds[innings.strikerIndex] ?? '',
      bowlerId: innings.currentBowlerId ?? '',
      runs,
      extras,
      totalRuns,
      wicket,
      isFreeHit: isFreeHit || undefined,
      timestamp: Date.now(),
    };

    await addDelivery(delivery);

    const newDeliveries = [...deliveries, delivery];
    const newStats = computeInningsStats(newDeliveries, nameOf);

    // An over is complete when the 6th LEGAL ball has just been bowled.
    // (Wides and no-balls don't count toward the 6, so ballIndex stays put for those.)
    const isOverComplete = isLegal && ballIndex === 5;

    // ── Innings live-state update ─────────────────────────────────────────────
    const updatedInnings = { ...innings };

    // ── Free hit state machine ─────────────────────────────────────────────────
    // Rules:
    //   per_noball              → any no-ball grants a free hit on the next delivery.
    //   two_consecutive_extras  → two consecutive wides/no-balls grant a free hit.
    //   none                    → auto-grant disabled; freeHitPending can still be
    //                             set manually via toggleFreeHit.
    //
    // A free hit is only consumed by a legal delivery (wide/no-ball on a free-hit
    // ball keeps it alive for the actual next legal ball).
    const freeHitMode = getFreeHitMode(match.rules);
    const prevConsecutive = innings.consecutiveExtrasCount ?? 0;
    let newConsecutive = isExtra ? prevConsecutive + 1 : 0;

    let newFreeHitPending: boolean;
    if (isNoBall) {
      // A no-ball always sets pending when the mode calls for it; it also
      // cancels any existing pending (scorer recorded a no-ball, not a free hit).
      if (freeHitMode === 'per_noball') {
        newFreeHitPending = true;
      } else if (freeHitMode === 'two_consecutive_extras' && newConsecutive >= 2) {
        newFreeHitPending = true;
        newConsecutive = 0; // reset: free hit granted, chain breaks
      } else {
        // Manual-only mode or not yet triggered: preserve existing pending unless
        // the scorer bowled a no-ball ON a free-hit (it's a new ball, reset).
        newFreeHitPending = isFreeHit ? false : (innings.freeHitPending ?? false);
      }
    } else if (isWide) {
      if (freeHitMode === 'two_consecutive_extras' && newConsecutive >= 2) {
        newFreeHitPending = true;
        newConsecutive = 0;
      } else {
        // A wide on a free-hit ball keeps the free hit alive (not consumed).
        newFreeHitPending = innings.freeHitPending ?? false;
      }
    } else {
      // Legal delivery: consume the free hit.
      newFreeHitPending = false;
    }

    updatedInnings.freeHitPending = newFreeHitPending;
    updatedInnings.consecutiveExtrasCount = newConsecutive;

    if (wicket) {
      // Bug 1+2 fix: determine WHICH slot belongs to the dismissed batsman.
      // The dismissed player is the striker unless it is explicitly a non-striker
      // run-out (wicket.runOutBatsmanId points to the non-striker).
      const strikerSlot    = innings.strikerIndex as 0 | 1;
      const nonStrikerSlot = (innings.strikerIndex ^ 1) as 0 | 1;
      const strikerId      = innings.currentBatsmanIds[strikerSlot] ?? '';
      const dismissedId    = wicket.runOutBatsmanId ?? strikerId;

      if (dismissedId === strikerId) {
        // ── Striker is out ──────────────────────────────────────────────────
        // Clear the striker's slot. Leave strikerIndex pointing at the now-empty
        // slot so handleWicketConfirm can fill it with the incoming batsman, who
        // will face the next delivery.
        const ids: [string, string | null] = [...innings.currentBatsmanIds] as [string, string | null];
        ids[strikerSlot] = '';
        updatedInnings.currentBatsmanIds = ids;
        // strikerIndex stays = strikerSlot (points to the empty slot the new batsman will occupy)

        // End-of-over rotation still applies: new batsman will be at non-striker end
        if (isOverComplete) {
          updatedInnings.strikerIndex = nonStrikerSlot;
        }
      } else {
        // ── Non-striker run-out ─────────────────────────────────────────────
        // Clear the non-striker's slot. Apply normal run-based + end-of-over
        // rotation (the running batsmen physically changed ends or didn't).
        const ids: [string, string | null] = [...innings.currentBatsmanIds] as [string, string | null];
        ids[nonStrikerSlot] = '';
        updatedInnings.currentBatsmanIds = ids;
        updatedInnings.strikerIndex = computeNextStrikerIndex(
          strikerSlot,
          runs,
          isWide,
          isOverComplete
        );
      }
    } else {
      // No wicket: standard strike rotation
      updatedInnings.strikerIndex = computeNextStrikerIndex(
        updatedInnings.strikerIndex,
        runs,
        isWide,
        isOverComplete
      );
    }

    // ── Innings-over detection ────────────────────────────────────────────────
    const { config, rules } = match;
    const maxWickets = rules.lastManStands ? config.playersPerSide : config.playersPerSide - 1;
    const oversComplete =
      newStats.overs >= config.overs &&
      newStats.balls === 0 &&
      newStats.legalBalls > 0;
    const isInningsOver = newStats.wickets >= maxWickets || oversComplete;

    if (isInningsOver) {
      updatedInnings.status = 'completed';
    }

    await saveInnings(updatedInnings);
    set({ innings: updatedInnings, deliveries: newDeliveries, stats: newStats, lastDelivery: delivery });

    return { delivery, isOverComplete, isInningsOver, newStats };
  },

  undoLastDelivery: async () => {
    const { match, innings, deliveries } = get();
    if (!innings || deliveries.length === 0) return;

    const allPlayers = match?.teams.flatMap((t) => t.players) ?? [];
    const nameOf = (id: string) => allPlayers.find((p) => p.id === id)?.name ?? id;

    await deleteLastDelivery(innings.id);
    const newDeliveries = deliveries.slice(0, -1);
    const newStats      = computeInningsStats(newDeliveries, nameOf);

    const updatedInnings = recomputeInningsLiveState(innings, newDeliveries, match ?? undefined);
    await saveInnings(updatedInnings);

    set({
      deliveries:    newDeliveries,
      stats:         newStats,
      innings:       updatedInnings,
      lastDelivery:  newDeliveries[newDeliveries.length - 1] ?? null,
    });
  },

  finaliseInnings: async (reason) => {
    const { innings } = get();
    if (!innings) return;
    const updated: Innings = { ...innings, status: 'completed', completedReason: reason };
    await saveInnings(updated);
    set({ innings: updated });
  },

  rotateStrike: async () => {
    const { innings } = get();
    if (!innings) return;
    const updated: Innings = {
      ...innings,
      strikerIndex: (innings.strikerIndex ^ 1) as 0 | 1,
    };
    await saveInnings(updated);
    set({ innings: updated });
  },

  changeBatsman: async (position: 0 | 1, newPlayerId: string) => {
    const { innings } = get();
    if (!innings) return;
    const ids: [string, string | null] = [...innings.currentBatsmanIds] as [string, string | null];
    ids[position] = newPlayerId;
    const battingOrder = innings.battingOrder.includes(newPlayerId)
      ? innings.battingOrder
      : [...innings.battingOrder, newPlayerId];
    const updated: Innings = { ...innings, currentBatsmanIds: ids, battingOrder };
    await saveInnings(updated);
    set({ innings: updated });
  },

  changeBowler: async (newBowlerId: string) => {
    const { innings } = get();
    if (!innings) return;
    const updated: Innings = { ...innings, currentBowlerId: newBowlerId };
    await saveInnings(updated);
    set({ innings: updated });
  },

  retireHurt: async (batsmanId: string, nextBatsmanId: string | null) => {
    const { innings } = get();
    if (!innings) return;

    // Identify which slot the retiring batsman occupies
    const [id0, id1] = innings.currentBatsmanIds;
    const slot = id0 === batsmanId ? 0 : id1 === batsmanId ? 1 : null;
    if (slot === null) return;

    const retiredHurtIds = [...(innings.retiredHurtIds ?? []), batsmanId];
    const ids: [string, string | null] = [...innings.currentBatsmanIds] as [string, string | null];

    if (nextBatsmanId) {
      // Bring in the replacement immediately
      ids[slot] = nextBatsmanId;
      const battingOrder = innings.battingOrder.includes(nextBatsmanId)
        ? innings.battingOrder
        : [...innings.battingOrder, nextBatsmanId];
      const updated: Innings = { ...innings, currentBatsmanIds: ids, battingOrder, retiredHurtIds };
      await saveInnings(updated);
      set({ innings: updated });
    } else {
      // No replacement available — clear the slot.
      // Slot 0 is typed string (never null), slot 1 is string | null.
      if (slot === 1) {
        ids[1] = null;
      } else {
        ids[0] = '';
      }
      const updated: Innings = { ...innings, currentBatsmanIds: ids, retiredHurtIds };
      await saveInnings(updated);
      set({ innings: updated });
    }
  },

  recallRetiredBatsman: async (batsmanId: string, position: 0 | 1) => {
    const { innings } = get();
    if (!innings) return;

    const ids: [string, string | null] = [...innings.currentBatsmanIds] as [string, string | null];
    ids[position] = batsmanId;
    const retiredHurtIds = (innings.retiredHurtIds ?? []).filter((id) => id !== batsmanId);
    const updated: Innings = { ...innings, currentBatsmanIds: ids, retiredHurtIds };
    await saveInnings(updated);
    set({ innings: updated });
  },

  toggleFreeHit: async () => {
    const { innings } = get();
    if (!innings) return;
    const updated: Innings = { ...innings, freeHitPending: !innings.freeHitPending };
    await saveInnings(updated);
    set({ innings: updated });
  },

  clear: () => set({ match: null, innings: null, deliveries: [], stats: null, lastDelivery: null }),
}));

// ─── Undo helper: re-derive full innings live state from delivery history ───────
function recomputeInningsLiveState(innings: Innings, deliveries: Delivery[], match?: Match): Innings {
  const dismissedIds = new Set(
    deliveries
      .filter((d) => d.wicket)
      .map((d) => d.wicket!.runOutBatsmanId ?? d.batsmanId)
  );

  // Rebuild batting order in the order batsmen first appeared in deliveries,
  // then append any IDs already known to innings (e.g. opening non-striker who
  // hasn't faced a ball yet).
  const battingOrder: string[] = [];
  for (const d of deliveries) {
    if (d.batsmanId && !battingOrder.includes(d.batsmanId)) {
      battingOrder.push(d.batsmanId);
    }
  }
  for (const id of innings.battingOrder) {
    if (id && !battingOrder.includes(id)) battingOrder.push(id);
  }

  // Current pair = first two undismissed batsmen in batting order
  const atCrease = battingOrder.filter((id) => id && !dismissedIds.has(id)).slice(0, 2);
  const slot0 = atCrease[0] ?? '';
  const slot1 = atCrease[1] ?? '';

  // Bug 4 fix: re-derive strikerIndex by replaying the entire delivery sequence.
  // We start with strikerIndex 0 (as set at innings creation) and simulate each
  // delivery's rotation, including end-of-over flips.
  let strikerIdx: 0 | 1 = 0;
  for (let i = 0; i < deliveries.length; i++) {
    const d = deliveries[i];
    const isWide = d.extras.wide > 0;
    // Determine if this was the last legal ball of its over
    const overDeliveries = deliveries.filter((x) => x.overIndex === d.overIndex);
    const legalInOver    = overDeliveries.filter(isLegalDelivery).length;
    const legalInOverSoFar = overDeliveries
      .slice(0, overDeliveries.indexOf(d) + 1)
      .filter(isLegalDelivery).length;
    const wasLastLegal = isLegalDelivery(d) && legalInOver === 6 && legalInOverSoFar === 6;

    if (d.wicket) {
      const batAtThisPoint  = battingOrder.filter((id) => {
        const priorDismissals = new Set(
          deliveries
            .slice(0, i + 1)
            .filter((x) => x.wicket)
            .map((x) => x.wicket!.runOutBatsmanId ?? x.batsmanId)
        );
        return !priorDismissals.has(id);
      });
      const dismissedId = d.wicket.runOutBatsmanId ?? d.batsmanId;
      // Rebuild who was striker at this point from batting order
      const striker = batAtThisPoint[0] ?? '';
      if (dismissedId === striker) {
        // Striker out: strikerIdx stays (empty slot); end-of-over flips
        if (wasLastLegal) strikerIdx = (strikerIdx ^ 1) as 0 | 1;
      } else {
        // Non-striker out: apply normal rotation
        strikerIdx = computeNextStrikerIndex(strikerIdx, d.runs, isWide, wasLastLegal);
      }
    } else {
      strikerIdx = computeNextStrikerIndex(strikerIdx, d.runs, isWide, wasLastLegal);
    }
  }

  // Bug 4 fix: re-derive currentBowlerId from the deliveries.
  // If the last over has fewer than 6 legal balls, the bowler of that over is
  // the current bowler. If the last over is complete (6 legal balls), we need a
  // new bowler selection → null.
  let currentBowlerId: string | null = null;
  if (deliveries.length > 0) {
    const lastDel        = deliveries[deliveries.length - 1];
    const currentOverDels = deliveries.filter((d) => d.overIndex === lastDel.overIndex);
    const legalInLastOver = currentOverDels.filter(isLegalDelivery).length;
    if (legalInLastOver < 6) {
      // Over still in progress — keep this bowler
      currentBowlerId = lastDel.bowlerId;
    }
    // If legalInLastOver === 6, the over is complete; currentBowlerId stays null
    // (ScoringPage will detect needsBowlerSelection and show the selector)
  }

  // Re-derive freeHitPending and consecutiveExtrasCount by replaying delivery history
  const freeHitMode = getFreeHitMode(match?.rules ?? { freeHitMode: 'none', maxOversPerBowler: 0, powerPlayOvers: 0, lastManStands: false, oneTipOneHand: false, noLBW: false, noByes: false, retiredHurtAllowed: false });
  let freeHitPending = false;
  let consecutiveExtrasCount = 0;
  for (const d of deliveries) {
    const isW  = d.extras.wide > 0;
    const isNB = d.extras.noBall > 0;
    const isEx = isW || isNB;
    consecutiveExtrasCount = isEx ? consecutiveExtrasCount + 1 : 0;
    if (isNB) {
      if (freeHitMode === 'per_noball') {
        freeHitPending = true;
      } else if (freeHitMode === 'two_consecutive_extras' && consecutiveExtrasCount >= 2) {
        freeHitPending = true;
        consecutiveExtrasCount = 0;
      } else {
        freeHitPending = d.isFreeHit ? false : freeHitPending;
      }
    } else if (isW) {
      if (freeHitMode === 'two_consecutive_extras' && consecutiveExtrasCount >= 2) {
        freeHitPending = true;
        consecutiveExtrasCount = 0;
      }
      // Wide on a free-hit keeps it alive — no change to freeHitPending
    } else {
      freeHitPending = false; // legal delivery consumed the free hit
    }
  }

  // Also restore 'active' status in case innings was marked completed before undo.
  // retiredHurtIds are not derived from deliveries — they live directly on innings,
  // so we carry them forward as-is.
  return {
    ...innings,
    battingOrder,
    currentBatsmanIds: [slot0, slot1],
    strikerIndex:      strikerIdx,
    currentBowlerId,
    status:            'active',
    completedReason:   undefined,
    retiredHurtIds:    innings.retiredHurtIds ?? [],
    freeHitPending,
    consecutiveExtrasCount,
  };
}
