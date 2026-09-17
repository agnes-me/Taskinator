'use server';

import { revalidatePath } from 'next/cache';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { requireSessionAndHousehold } from '@/lib/require-session';
import { requireMembership } from '@/lib/current-household';
import { computeNextDueDate } from '@/lib/recurrence';
import type { Priority, RecurrenceType } from '@/lib/types';

function parseWeekdays(formData: FormData): string | null {
  const days = formData.getAll('weekday').map(String).filter(Boolean);
  return days.length ? days.join(',') : null;
}

async function requireUserId() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error('Non authentifié.');
  return session.user.id;
}

/** Résout et vérifie le foyer d'une tâche existante (peu importe le conteneur "actif"). */
async function requireTaskHousehold(userId: string, taskId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return null;
  await requireMembership(userId, task.householdId);
  return task;
}

export async function saveTask(formData: FormData) {
  const userId = await requireUserId();

  const id = formData.get('id') ? String(formData.get('id')) : null;
  const title = String(formData.get('title') ?? '').trim();
  if (!title) return;

  let householdId: string;
  if (id) {
    const existing = await requireTaskHousehold(userId, id);
    if (!existing) return;
    householdId = existing.householdId;
  } else {
    const explicitHouseholdId = String(formData.get('householdId') ?? '');
    if (explicitHouseholdId) {
      await requireMembership(userId, explicitHouseholdId);
      householdId = explicitHouseholdId;
    } else {
      householdId = (await requireSessionAndHousehold()).household.id;
    }
  }

  const description = String(formData.get('description') ?? '').trim() || null;
  const categoryId = String(formData.get('categoryId') ?? '') || null;
  const zoneId = String(formData.get('zoneId') ?? '') || null;
  const assigneeId = String(formData.get('assigneeId') ?? '') || null;
  const priority = String(formData.get('priority') ?? 'MEDIUM') as Priority;
  const recurrenceType = String(formData.get('recurrenceType') ?? 'NONE') as RecurrenceType;
  const recurrenceInterval = Math.max(1, parseInt(String(formData.get('recurrenceInterval') ?? '1'), 10) || 1);
  const recurrenceWeekdays =
    recurrenceType === 'WEEKLY' || recurrenceType === 'MONTHLY' ? parseWeekdays(formData) : null;
  const dueDateRaw = String(formData.get('dueDate') ?? '');
  const dueDate = dueDateRaw ? new Date(dueDateRaw) : null;

  const data = {
    householdId,
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
    await prisma.task.update({ where: { id }, data });
  } else {
    await prisma.task.create({ data: { ...data, createdByUserId: userId } });
  }

  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath('/overview');
}

export async function completeTask(taskId: string) {
  const userId = await requireUserId();
  const task = await requireTaskHousehold(userId, taskId);
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
  revalidatePath('/overview');
}

export async function deleteTask(taskId: string) {
  const userId = await requireUserId();
  const task = await requireTaskHousehold(userId, taskId);
  if (!task) return;
  await prisma.task.delete({ where: { id: taskId } });
  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath('/overview');
}

export async function pauseTask(formData: FormData) {
  const userId = await requireUserId();
  const taskId = String(formData.get('taskId') ?? '');
  const untilRaw = String(formData.get('until') ?? '');
  const reason = String(formData.get('reason') ?? '').trim() || null;
  if (!taskId || !untilRaw) return;

  const task = await requireTaskHousehold(userId, taskId);
  if (!task) return;

  await prisma.task.update({
    where: { id: taskId },
    data: { pausedUntil: new Date(untilRaw), pauseReason: reason },
  });
  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath('/overview');
}

export async function resumeTask(taskId: string) {
  const userId = await requireUserId();
  const task = await requireTaskHousehold(userId, taskId);
  if (!task) return;

  await prisma.task.update({ where: { id: taskId }, data: { pausedUntil: null, pauseReason: null } });
  revalidatePath('/tasks');
  revalidatePath('/dashboard');
  revalidatePath('/overview');
}
