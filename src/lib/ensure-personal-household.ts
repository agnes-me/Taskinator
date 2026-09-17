import { prisma } from '@/lib/prisma';
import { generateCode, generateToken } from '@/lib/ids';

/**
 * Garantit que l'utilisateur a un conteneur personnel (non partagé par défaut), utile
 * pour ses affaires perso séparément d'un foyer partagé. Idempotent : ne crée rien si un
 * conteneur "isPersonal" existe déjà pour cet utilisateur. Appelé à l'inscription, et
 * rétroactivement pour les comptes déjà existants.
 */
export async function ensurePersonalHousehold(userId: string, userName: string) {
  const existing = await prisma.membership.findFirst({
    where: { userId, household: { isPersonal: true } },
    include: { household: true },
  });
  if (existing) return existing.household;

  const household = await prisma.household.create({
    data: { name: 'Perso', inviteCode: generateCode(6), icsToken: generateToken(32), isPersonal: true },
  });
  await prisma.membership.create({ data: { userId, householdId: household.id, role: 'OWNER' } });
  await prisma.profile.create({ data: { householdId: household.id, displayName: userName, linkedUserId: userId } });

  return household;
}
