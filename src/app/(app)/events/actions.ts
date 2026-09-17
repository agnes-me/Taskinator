'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSessionAndHousehold } from '@/lib/require-session';

export async function deleteEvent(eventId: string) {
  const { household } = await requireSessionAndHousehold();
  await prisma.event.deleteMany({ where: { id: eventId, householdId: household.id } });
  revalidatePath('/events');
  redirect('/events');
}
