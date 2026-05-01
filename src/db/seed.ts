import { v4 as uuid } from 'uuid';
import { db } from '@/db/database';
import type { SavedTeam } from '@/types/player.types';

const SEED_FLAG = 'db_seeded_wacky_v1';

const WACKY_PLAYERS = [
  'Abdul','Amin','Anand','Andu Senthil','Arun','Ashok',
  'Babu.R','Babu.V','Balaji','Chandru','Dinesh','Egha',
  'Ganesh','Guru','Hari','Jebin','Kannan','Karthikeyan',
  'Karthi Lara','Kathir','Mani','Mohan','Naveen','Naveen Jr.',
  'Pari','Prasanna','Praveen','Raghul','Raja','Rajasekhar',
  'Rajesh','Rajavarman','Ramachandran','Ramgopal','Rithik',
  'Saikannan','Saiprasath','Sanjay','Saravanan','Sathyamurthi',
  'Selvam','Selvaraj','Senthil','Sri Hari','Sureshkumar','Tamil','Thyagu',
];

export async function seedDefaultData(): Promise<void> {
  if (localStorage.getItem(SEED_FLAG)) return;

  const existing = await db.savedTeams.where('name').equalsIgnoreCase('Wacky').count();
  if (existing > 0) {
    localStorage.setItem(SEED_FLAG, '1');
    return;
  }

  const team: SavedTeam = {
    id: uuid(),
    name: 'Wacky',
    players: WACKY_PLAYERS.map((name) => ({ id: uuid(), name })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.savedTeams.put(team);
  localStorage.setItem(SEED_FLAG, '1');
}
