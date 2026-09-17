import { cookies } from 'next/headers';
import { prisma } from '@/lib/prisma';

export const ACTIVE_HOUSEHOLD_COOKIE = 'taskinator_active_household';

/** Tous les conteneurs (foyers) dont l'utilisateur est membre, avec son rôle dans chacun. */
export async function getUserHouseholds(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    include: { household: { include: { _count: { select: { memberships: true } } } } },
    orderBy: { createdAt: 'asc' },
  });
  return memberships.map((m) => ({ household: m.household, role: m.role }));
}

/**
 * Conteneur actif de l'utilisateur : celui mémorisé dans le cookie s'il en est toujours
 * membre, sinon le premier rejoint. Permet d'avoir plusieurs conteneurs (ex: "Maison" et
 * "Association") et de basculer de l'un à l'autre.
 */
export async function getCurrentHousehold(userId: string) {
  const cookieStore = await cookies();
  const preferredId = cookieStore.get(ACTIVE_HOUSEHOLD_COOKIE)?.value;

  if (preferredId) {
    const membership = await prisma.membership.findUnique({
      where: { userId_householdId: { userId, householdId: preferredId } },
      include: { household: true },
    });
    if (membership) return membership.household;
  }

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
