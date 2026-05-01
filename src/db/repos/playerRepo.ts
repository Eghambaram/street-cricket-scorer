import { db } from '@/db/database';
import type { Delivery } from '@/types/delivery.types';

export async function getInningsDeliveries(inningsId: string): Promise<Delivery[]> {
  return db.deliveries
    .where('inningsId')
    .equals(inningsId)
    .sortBy('deliverySequence');
}

export async function addDelivery(delivery: Delivery): Promise<void> {
  await db.deliveries.add(delivery);
}

export async function deleteLastDelivery(inningsId: string): Promise<Delivery | null> {
  const deliveries = await getInningsDeliveries(inningsId);
  if (deliveries.length === 0) return null;
  const last = deliveries[deliveries.length - 1];
  await db.deliveries.delete(last.id);
  return last;
}

export async function getAllDeliveries(): Promise<Delivery[]> {
  return db.deliveries.toArray();
}
