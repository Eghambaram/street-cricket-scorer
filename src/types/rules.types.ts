/** How free hits are automatically granted during a match */
export type FreeHitMode =
  | 'none'                    // no auto-grant; scorer can still tap the Free Hit button manually
  | 'per_noball'              // every no-ball → next legal delivery is a free hit
  | 'two_consecutive_extras'; // two consecutive extras (wide or no-ball) → free hit

export interface StreetCricketRules {
  lastManStands: boolean;       // last batsman bats alone (no partner required)
  oneTipOneHand: boolean;       // catch off one bounce with one hand = out
  noLBW: boolean;               // LBW dismissals not applicable
  noByes: boolean;              // bye extras not counted
  retiredHurtAllowed: boolean;  // batsman can retire and return later
  freeHitMode?: FreeHitMode;    // free-hit rule (optional for backward compat with old matches)
  /** @deprecated use freeHitMode instead; kept for reading old stored matches */
  freeHitOnNoBall?: boolean;
  maxOversPerBowler: number;    // 0 = no restriction
  powerPlayOvers: number;       // 0 = no powerplay
}

export const DEFAULT_RULES: StreetCricketRules = {
  lastManStands: true,
  oneTipOneHand: false,
  noLBW: true,
  noByes: false,
  retiredHurtAllowed: true,
  freeHitMode: 'none',
  maxOversPerBowler: 0,
  powerPlayOvers: 0,
};

/** Read the effective free-hit mode, including old matches that stored freeHitOnNoBall */
export function getFreeHitMode(rules: StreetCricketRules): FreeHitMode {
  if (rules.freeHitMode) return rules.freeHitMode;
  return rules.freeHitOnNoBall ? 'per_noball' : 'none';
}
