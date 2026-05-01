import Dexie, { type Table } from 'dexie';
import type { Match, Innings } from '@/types/match.types';
import type { Delivery } from '@/types/delivery.types';
import type { SavedTeam } from '@/types/player.types';

export class CricketDB extends Dexie {
  matches!: Table<Match, string>;
  innings!: Table<Innings, string>;
  deliveries!: Table<Delivery, string>;
  savedTeams!: Table<SavedTeam, string>;

  constructor() {
    super('StreetCricketScorerDB');

    this.version(1).stores({
      matches: 'id, status, createdAt',
      innings: 'id, matchId, inningsNumber, status',
      deliveries: 'id, inningsId, overIndex, ballIndex, deliverySequence, timestamp',
    });

    this.version(2).stores({
      matches: 'id, status, createdAt',
      innings: 'id, matchId, inningsNumber, status',
      deliveries: 'id, inningsId, overIndex, ballIndex, deliverySequence, timestamp',
      savedTeams: 'id, name, createdAt',
    });
  }
}

export const db = new CricketDB();
