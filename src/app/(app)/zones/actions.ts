'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireMembership } from '@/lib/current-household';

async function requireUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('Non authentifié.');
  return session.user.id;
}

/**
 * Applique un template de zone (ex: "Cuisine") à une zone donnée : crée directement les
 * tâches sélectionnées, sans passer par un évènement (pas de nom/date à saisir), avec
 * leur périodicité déjà réglée.
 */
export async function applyZoneTemplate(formData: FormData) {
  const userId = await requireUserId();
  const zoneId = String(formData.get('zoneId') ?? '');
  const templateId = String(formData.get('templateId') ?? '');
  const itemIds = formData.getAll('itemId').map(String);
  if (!zoneId || !templateId || itemIds.length === 0) return;

  const zone = await prisma.zone.findUnique({ where: { id: zoneId } });
  if (!zone) return;
  await requireMembership(userId, zone.householdId);

  const template = await prisma.taskTemplate.findFirst({
    where: { id: templateId, OR: [{ householdId: zone.householdId }, { householdId: null }] },
    include: { items: { where: { id: { in: itemIds } } } },
  });
  if (!template) return;

  let categoryId: string | null = null;
  if (template.defaultCategoryName) {
    const existing = await prisma.category.findFirst({
      where: { householdId: zone.householdId, name: template.defaultCategoryName },
    });
    categoryId = existing
      ? existing.id
      : (
          await prisma.category.create({
            data: {
              householdId: zone.householdId,
              name: template.defaultCategoryName,
              icon: template.defaultCategoryIcon ?? '✅',
              color: template.defaultCategoryColor ?? '#0d9488',
              kind: template.defaultCategoryKind ?? 'OTHER',
            },
          })
        ).id;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.task.createMany({
    data: template.items.map((item) => ({
      householdId: zone.householdId,
      title: item.title,
      description: item.description,
      categoryId,
      zoneId: zone.id,
      priority: item.priority ?? 'MEDIUM',
      recurrenceType: item.recurrenceType ?? 'NONE',
      recurrenceInterval: item.recurrenceInterval ?? 1,
      dueDate: today,
      templateItemId: item.id,
      createdByUserId: userId,
    })),
  });

  revalidatePath(`/zones/${zoneId}`);
  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath('/overview');
}
