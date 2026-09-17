import { prisma } from '@/lib/prisma';

/** Foyer courant de l'utilisateur (MVP : premier foyer rejoint). */
export async function getCurrentHousehold(userId: string) {
  const membership = await prisma.membership.findFirst({
    where: { userId },
    include: { household: true },
    orderBy: { createdAt: 'asc' },
  });
  return membership?.household ?? null;
}

export async function requireMembership(userId: string, householdId: string) {
  const membership = await prisma.membership.findUnique({
    where: { userId_householdId: { userId, householdId } },
  });
  if (!membership) {
    throw new Error('Vous ne faites pas partie de ce foyer.');
  }
  return membership;
}
