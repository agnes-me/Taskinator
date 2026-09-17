'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireSessionAndHousehold } from '@/lib/require-session';
import type { TemplateType } from '@/lib/types';

export async function createTemplate(formData: FormData) {
  const { userId, household } = await requireSessionAndHousehold();
  const name = String(formData.get('name') ?? '').trim();
  if (!name) return;
  const description = String(formData.get('description') ?? '').trim() || null;
  const icon = String(formData.get('icon') ?? '📋').trim() || '📋';
  const type = String(formData.get('type') ?? 'CHECKLIST') as TemplateType;

  const template = await prisma.taskTemplate.create({
    data: { householdId: household.id, name, description, icon, type, createdByUserId: userId },
  });

  revalidatePath('/templates');
  redirect(`/templates/${template.id}`);
}

export async function deleteTemplate(templateId: string) {
  const { household } = await requireSessionAndHousehold();
  await prisma.taskTemplate.deleteMany({ where: { id: templateId, householdId: household.id } });
  revalidatePath('/templates');
  redirect('/templates');
}

export async function addTemplateItem(formData: FormData) {
  const { household } = await requireSessionAndHousehold();
  const templateId = String(formData.get('templateId') ?? '');
  const title = String(formData.get('title') ?? '').trim();
  if (!templateId || !title) return;

  const template = await prisma.taskTemplate.findFirst({ where: { id: templateId, householdId: household.id } });
  if (!template) return;

  const categoryId = String(formData.get('categoryId') ?? '') || null;
  const zoneId = String(formData.get('zoneId') ?? '') || null;
  const offsetRaw = String(formData.get('offsetDays') ?? '').trim();
  const offsetDays = offsetRaw === '' ? null : parseInt(offsetRaw, 10);
  const perPerson = formData.get('perPerson') === 'on';
  const count = await prisma.taskTemplateItem.count({ where: { templateId } });

  await prisma.taskTemplateItem.create({
    data: { templateId, title, categoryId, zoneId, offsetDays, perPerson, sortOrder: count },
  });

  revalidatePath(`/templates/${templateId}`);
}

export async function deleteTemplateItem(itemId: string) {
  const { household } = await requireSessionAndHousehold();
  const item = await prisma.taskTemplateItem.findFirst({
    where: { id: itemId, template: { householdId: household.id } },
  });
  if (!item) return;
  await prisma.taskTemplateItem.delete({ where: { id: itemId } });
  revalidatePath(`/templates/${item.templateId}`);
}

export async function instantiateTemplate(formData: FormData) {
  const { userId, household } = await requireSessionAndHousehold();
  const templateId = String(formData.get('templateId') ?? '');
  const eventName = String(formData.get('eventName') ?? '').trim();
  const eventDateRaw = String(formData.get('eventDate') ?? '');
  if (!templateId || !eventName || !eventDateRaw) return;

  const template = await prisma.taskTemplate.findFirst({
    where: { id: templateId, OR: [{ householdId: household.id }, { householdId: null }] },
    include: { items: true },
  });
  if (!template) return;

  const eventDate = new Date(eventDateRaw);
  const selectedProfileIds = formData.getAll('profileId').map(String);

  const event = await prisma.event.create({
    data: {
      householdId: household.id,
      name: eventName,
      eventDate,
      templateId: template.id,
      createdByUserId: userId,
    },
  });

  // Templates système : la catégorie par défaut est retrouvée/créée dans CE foyer,
  // faute de pouvoir référencer directement une Category d'un foyer précis.
  let defaultCategoryId: string | null = null;
  if (template.defaultCategoryName) {
    const existing = await prisma.category.findFirst({
      where: { householdId: household.id, name: template.defaultCategoryName },
    });
    defaultCategoryId = existing
      ? existing.id
      : (
          await prisma.category.create({
            data: {
              householdId: household.id,
              name: template.defaultCategoryName,
              icon: template.defaultCategoryIcon ?? '✅',
              color: template.defaultCategoryColor ?? '#0d9488',
              kind: template.defaultCategoryKind ?? 'OTHER',
            },
          })
        ).id;
  }

  // Idem pour les zones nommées par les éléments du template (ex: "Cuisine", "Garage"...).
  const zoneCache = new Map<string, string>();
  async function resolveZoneId(zoneName: string): Promise<string> {
    const cached = zoneCache.get(zoneName);
    if (cached) return cached;
    const existing = await prisma.zone.findFirst({ where: { householdId: household.id, name: zoneName } });
    const zoneId = existing
      ? existing.id
      : (await prisma.zone.create({ data: { householdId: household.id, name: zoneName } })).id;
    zoneCache.set(zoneName, zoneId);
    return zoneId;
  }

  const tasksToCreate: {
    householdId: string;
    title: string;
    description: string | null;
    categoryId: string | null;
    zoneId: string | null;
    assigneeId: string | null;
    priority: string;
    recurrenceType: string;
    recurrenceInterval: number;
    dueDate: Date;
    eventId: string;
    templateItemId: string;
    createdByUserId: string;
  }[] = [];

  for (const item of template.items) {
    const dueDate = new Date(eventDate);
    dueDate.setDate(dueDate.getDate() + (item.offsetDays ?? 0));

    const categoryId = item.categoryId ?? defaultCategoryId;
    const zoneId = item.zoneId ?? (item.zoneName ? await resolveZoneId(item.zoneName) : null);
    const priority = item.priority ?? 'MEDIUM';
    const recurrenceType = item.recurrenceType ?? 'NONE';
    const recurrenceInterval = item.recurrenceInterval ?? 1;

    if (item.perPerson && selectedProfileIds.length > 0) {
      for (const profileId of selectedProfileIds) {
        const profile = await prisma.profile.findFirst({ where: { id: profileId, householdId: household.id } });
        if (!profile) continue;
        tasksToCreate.push({
          householdId: household.id,
          title: `${item.title} — ${profile.displayName}`,
          description: item.description,
          categoryId,
          zoneId,
          assigneeId: profile.id,
          priority,
          recurrenceType,
          recurrenceInterval,
          dueDate,
          eventId: event.id,
          templateItemId: item.id,
          createdByUserId: userId,
        });
      }
    } else {
      tasksToCreate.push({
        householdId: household.id,
        title: item.title,
        description: item.description,
        categoryId,
        zoneId,
        assigneeId: null,
        priority,
        recurrenceType,
        recurrenceInterval,
        dueDate,
        eventId: event.id,
        templateItemId: item.id,
        createdByUserId: userId,
      });
    }
  }

  if (tasksToCreate.length > 0) {
    await prisma.task.createMany({ data: tasksToCreate });
  }

  revalidatePath('/events');
  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  redirect(`/events/${event.id}`);
}
