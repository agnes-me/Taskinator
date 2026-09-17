'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { generateCode, generateToken } from '@/lib/ids';
import { seedDefaultsForHousehold } from '@/lib/seed-defaults';
import { ACTIVE_HOUSEHOLD_COOKIE } from '@/lib/current-household';

async function requireUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('Non authentifié.');
  return session.user.id;
}

async function setActiveHousehold(householdId: string) {
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_HOUSEHOLD_COOKIE, householdId, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function switchContainer(formData: FormData) {
  const userId = await requireUserId();
  const householdId = String(formData.get('householdId') ?? '');
  const membership = await prisma.membership.findUnique({
    where: { userId_householdId: { userId, householdId } },
  });
  if (!membership) return;

  await setActiveHousehold(householdId);
  redirect('/dashboard');
}

export async function createContainer(formData: FormData) {
  const userId = await requireUserId();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) redirect('/containers?error=Nom+manquant');

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('Utilisateur introuvable.');

  const household = await prisma.household.create({
    data: { name, inviteCode: generateCode(6), icsToken: generateToken(32) },
  });
  await prisma.membership.create({ data: { userId, householdId: household.id, role: 'OWNER' } });
  await prisma.profile.create({ data: { householdId: household.id, displayName: user.name, linkedUserId: userId } });
  await seedDefaultsForHousehold(household.id);

  await setActiveHousehold(household.id);
  redirect('/dashboard');
}

export async function joinContainer(formData: FormData) {
  const userId = await requireUserId();
  const inviteCode = String(formData.get('inviteCode') ?? '').toUpperCase().trim();
  if (!inviteCode) redirect('/containers?error=Code+manquant');

  const household = await prisma.household.findUnique({ where: { inviteCode } });
  if (!household) redirect('/containers?error=Code+invalide');

  const existing = await prisma.membership.findUnique({
    where: { userId_householdId: { userId, householdId: household!.id } },
  });
  if (existing) {
    await setActiveHousehold(household!.id);
    redirect('/dashboard');
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('Utilisateur introuvable.');

  await prisma.membership.create({ data: { userId, householdId: household!.id, role: 'MEMBER' } });
  await prisma.profile.create({ data: { householdId: household!.id, displayName: user.name, linkedUserId: userId } });

  await setActiveHousehold(household!.id);
  redirect('/dashboard');
}
