'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { requireSessionAndHousehold } from '@/lib/require-session';
import { computeNextDueDate } from '@/lib/recurrence';
import type { Priority, RecurrenceType } from '@/lib/types';

function parseWeekdays(formData: FormData): string | null {
  const days = formData.getAll('weekday').map(String);
  return days.length ? days.join(',') : null;
}

export async function saveTask(formData: FormData) {
  const { userId, household } = await requireSessionAndHousehold();

  const id = formData.get('id') ? String(formData.get('id')) : null;
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return;

  const description = String(formData.get('description') ?? '').trim() || null;
  const categoryId = String(formData.get('categoryId') ?? '') || null;
  const zoneId = String(formData.get('zoneId') ?? '') || null;
  const assigneeId = String(formData.get('assigneeId') ?? '') || null;
  const priority = String(formData.get('priority') ?? 'MEDIUM') as Priority;
  const recurrenceType = String(formData.get('recurrenceType') ?? 'NONE') as RecurrenceType;
  const recurrenceInterval = Math.max(1, parseInt(String(formData.get('recurrenceInterval') ?? '1'), 10) || 1);
  const recurrenceWeekdays = recurrenceType === 'WEEKLY' ? parseWeekdays(formData) : null;
  const dueDateRaw = String(formData.get('dueDate') ?? '');
  const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;

  const data = {
    householdId: household.id,
    title,
    description,
    categoryId,
    zoneId,
    assigneeId,
    priority,
    recurrenceType,
    recurrenceInterval,
    recurrenceWeekdays,
    dueDate,
  };

  if (id) {
    await prisma.task.updateMany({ where: { id, householdId: household.id }, data });
  } else {
    await prisma.task.create({ data: { ...data, createdByUserId: userId } });
  }

  revalidatePath('/tasks');
  revalidatePath('/dashboard');
}

export async function completeTask(taskId: string) {
  const { userId, household } = await requireSessionAndHousehold();

  const task = await prisma.task.findFirst({ where: { id: taskId, householdId: household.id } });
  if (!task) return;

  const now = new Date();

  await prisma.taskCompletion.create({
    data: { taskId: task.id, profileId: task.assigneeId, completedByUserId: userId, completedAt: now },
  });

  if (task.recurrenceType === 'NONE') {
    await prisma.task.update({ where: { id: task.id }, data: { status: 'DONE', lastCompletedAt: now } });
  } else {
    const nextDue = computeNextDueDate({
      recurrenceType: task.recurrenceType as RecurrenceType,
      recurrenceInterval: task.recurrenceInterval,
      recurrenceWeekdays: task.recurrenceWeekdays,
      from: now,
    });
    await prisma.task.update({
      where: { id: task.id },
      data: { status: 'TODO', lastCompletedAt: now, dueDate: nextDue },
    });
  }

  revalidatePath('/tasks');
  revalidatePath('/dashboard');
}

export async function deleteTask(taskId: string) {
  const { household } = await requireSessionAndHousehold();
  await prisma.task.deleteMany({ where: { id: taskId, householdId: household.id } });
  revalidatePath('/tasks');
  revalidatePath('/dashboard');
}

export async function pauseTask(formData: FormData) {
  const { household } = await requireSessionAndHousehold();
  const taskId = String(formData.get('taskId') ?? '');
  const untilRaw = String(formData.get('until') ?? '');
  const reason = String(formData.get('reason') ?? '').trim() || null;
  if (!taskId || !untilRaw) return;

  await prisma.task.updateMany({
    where: { id: taskId, householdId: household.id },
    data: { pausedUntil: new Date(untilRaw), pauseReason: reason },
  });
  revalidatePath('/tasks');
  revalidatePath('/dashboard');
}

export async function resumeTask(taskId: string) {
  const { household } = await requireSessionAndHousehold();
  await prisma.task.updateMany({
    where: { id: taskId, householdId: household.id },
    data: { pausedUntil: null, pauseReason: null },
  });
  revalidatePath('/tasks');
  revalidatePath('/dashboard');
}
