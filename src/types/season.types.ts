/** A stats period (e.g. a 3-month league). Only matches tagged with its id count. */
export interface Season {
  id: string;
  name: string;
  startAt: number;   // epoch ms, start of the first day
  endAt: number;     // epoch ms, end of the last day
  createdAt: number;
}

/** Per-player record used by the fair team generator. */
export interface FairnessRecord {
  firstCount: number;            // times picked as captain (first pick)
  lastFirstGeneration: number;   // generation of the last captaincy; -999999 = never
  topDraws: number;              // times drawn in the top half of the order
  totalDraws: number;            // times included in a recorded generation
}

/** Fair generator history. One row (id 'default'), keyed by saved player id. */
export interface FairnessHistory {
  id: string;
  generation: number;
  players: Record<string, FairnessRecord>;
}
