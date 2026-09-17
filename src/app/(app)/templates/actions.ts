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
    where: { id: templateId, householdId: household.id },
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

  const tasksToCreate: {
    householdId: string;
    title: string;
    categoryId: string | null;
    zoneId: string | null;
    assigneeId: string | null;
    dueDate: Date;
    eventId: string;
    templateItemId: string;
    createdByUserId: string;
  }[] = [];

  for (const item of template.items) {
    const dueDate = new Date(eventDate);
    dueDate.setDate(dueDate.getDate() + (item.offsetDays ?? 0));

    if (item.perPerson && selectedProfileIds.length > 0) {
      for (const profileId of selectedProfileIds) {
        const profile = await prisma.profile.findFirst({ where: { id: profileId, householdId: household.id } });
        if (!profile) continue;
        tasksToCreate.push({
          householdId: household.id,
          title: `${item.title} — ${profile.displayName}`,
          categoryId: item.categoryId,
          zoneId: item.zoneId,
          assigneeId: profile.id,
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
        categoryId: item.categoryId,
        zoneId: item.zoneId,
        assigneeId: null,
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
