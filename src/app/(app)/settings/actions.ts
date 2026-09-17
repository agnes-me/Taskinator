'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSessionAndHousehold } from '@/lib/require-session';

export async function updateHouseholdName(formData: FormData) {
  const { household } = await requireSessionAndHousehold();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;
  await prisma.household.update({ where: { id: household.id }, data: { name } });
  revalidatePath('/settings');
}

export async function pauseReminders(formData: FormData) {
  const { household } = await requireSessionAndHousehold();
  const untilRaw = String(formData.get('until') ?? '');
  const reason = String(formData.get('reason') ?? '').trim() || null;
  const until = untilRaw ? new Date(untilRaw) : null;
  await prisma.household.update({
    where: { id: household.id },
    data: { remindersPausedUntil: until, remindersPauseReason: until ? reason : null },
  });
  revalidatePath('/settings');
  revalidatePath('/dashboard');
  revalidatePath('/tasks');
}

export async function resumeReminders() {
  const { household } = await requireSessionAndHousehold();
  await prisma.household.update({
    where: { id: household.id },
    data: { remindersPausedUntil: null, remindersPauseReason: null },
  });
  revalidatePath('/settings');
  revalidatePath('/dashboard');
  revalidatePath('/tasks');
}

export async function createZone(formData: FormData) {
  const { household } = await requireSessionAndHousehold();
  const name = String(formData.get('name') ?? '').trim();
  const icon = String(formData.get('icon') ?? '🏠').trim() || '🏠';
  if (!name) return;
  const zone = await prisma.zone.create({ data: { householdId: household.id, name, icon } });
  revalidatePath('/settings');
  // On file directement vers la zone créée : si un template correspond à son nom
  // (ex: "Cuisine"), ses tâches types sont proposées tout de suite.
  redirect(`/zones/${zone.id}`);
}

export async function deleteZone(zoneId: string) {
  const { household } = await requireSessionAndHousehold();
  await prisma.zone.deleteMany({ where: { id: zoneId, householdId: household.id } });
  revalidatePath('/settings');
}

export async function createCategory(formData: FormData) {
  const { household } = await requireSessionAndHousehold();
  const name = String(formData.get('name') ?? '').trim();
  const icon = String(formData.get('icon') ?? '✅').trim() || '✅';
  const color = String(formData.get('color') ?? '#0d9488').trim();
  const kind = String(formData.get('kind') ?? 'OTHER') as
    | 'CHORE'
    | 'SHOPPING'
    | 'PACKING'
    | 'EVENT'
    | 'ADMIN'
    | 'OTHER';
  if (!name) return;
  await prisma.category.create({ data: { householdId: household.id, name, icon, color, kind } });
  revalidatePath('/settings');
}

export async function deleteCategory(categoryId: string) {
  const { household } = await requireSessionAndHousehold();
  await prisma.category.deleteMany({ where: { id: categoryId, householdId: household.id } });
  revalidatePath('/settings');
}

export async function addProfile(formData: FormData) {
  const { household } = await requireSessionAndHousehold();
  const displayName = String(formData.get('displayName') ?? '').trim();
  const isChild = formData.get('isChild') === 'on';
  const color = String(formData.get('color') ?? '#14b8a6').trim();
  if (!displayName) return;
  await prisma.profile.create({ data: { householdId: household.id, displayName, isChild, color } });
  revalidatePath('/settings');
}

export async function removeProfile(profileId: string) {
  const { household } = await requireSessionAndHousehold();
  await prisma.profile.deleteMany({ where: { id: profileId, householdId: household.id } });
  revalidatePath('/settings');
}
