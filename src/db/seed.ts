import { v4 as uuid } from 'uuid';
import { db } from '@/db/database';
import type { SavedTeam, SkillLevel } from '@/types/player.types';

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

const HIGH_SKILL = new Set([
  'Abdul', 'Amin', 'Anand', 'Andu Senthil', 'Arun', 'Tamil', 'Babu.R', 'Babu.V',
  'Chandru', 'Egha', 'Ganesh', 'Hari', 'Jebin', 'Kannan', 'Mani', 'Selvaraj',
  'Senthil', 'Ramgopal', 'Raja', 'Sanjay', 'Sathyamurthi',
]);

const MEDIUM_SKILL = new Set([
  'Naveen', 'Kathir', 'Naveen Jr.', 'Pari', 'Prasanna', 'Praveen', 'Raghul',
  'Rajasekhar', 'Rajesh', 'Rajavarman', 'Ramachandran', 'Rithik', 'Saikannan',
  'Saiprasath', 'Saravanan', 'Selvam', 'Sri Hari', 'Sureshkumar', 'Thyagu',
]);

function skillFor(name: string): SkillLevel {
  if (HIGH_SKILL.has(name)) return 'high';
  if (MEDIUM_SKILL.has(name)) return 'medium';
  return 'low';
}

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
    players: WACKY_PLAYERS.map((name) => ({ id: uuid(), name, skillLevel: skillFor(name) })),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  await db.savedTeams.put(team);
  localStorage.setItem(SEED_FLAG, '1');
}
