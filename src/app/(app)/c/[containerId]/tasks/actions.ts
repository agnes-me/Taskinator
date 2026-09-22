'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Priority, RecurrenceType } from '@/types/database';
import { syncTaskUpsert, syncTaskDone, syncTaskDeleted } from '@/lib/google-task-sync';

function parseTaskFields(formData: FormData) {
  const weekdays = formData.getAll('weekday').join(',');
  return {
    title: String(formData.get('title') ?? '').trim(),
    description: String(formData.get('description') ?? '').trim() || null,
    room_id: String(formData.get('roomId') ?? '') || null,
    priority: (String(formData.get('priority') ?? 'medium') as Priority) || 'medium',
    recurrence_type: (String(formData.get('recurrenceType') ?? 'none') as RecurrenceType) || 'none',
    recurrence_interval: Math.max(1, Number(formData.get('recurrenceInterval') ?? 1) || 1),
    recurrence_weekdays: weekdays || null,
    due_date: String(formData.get('dueDate') ?? '') || null,
    on_calendar: formData.get('onCalendar') === 'on',
    start_at: String(formData.get('startAt') ?? '') || null,
    duration_minutes: formData.get('durationMinutes') ? Number(formData.get('durationMinutes')) : null,
    freshness_days: formData.get('freshnessDays') ? Number(formData.get('freshnessDays')) : null,
    seasonal_start_month: formData.get('seasonalStart') ? Number(formData.get('seasonalStart')) : null,
    seasonal_end_month: formData.get('seasonalEnd') ? Number(formData.get('seasonalEnd')) : null,
  };
}

function revalidateTaskPaths(containerId: string) {
  revalidatePath(`/c/${containerId}/tasks`);
  revalidatePath(`/c/${containerId}`);
  revalidatePath(`/c/${containerId}/events`);
  revalidatePath(`/c/${containerId}/calendar`);
}

export async function createTask(containerId: string, formData: FormData) {
  const fields = parseTaskFields(formData);
  if (!fields.title) return { error: 'Le titre est requis.' };

  const parentTaskId = String(formData.get('parentTaskId') ?? '') || null;
  const sourceEventId = String(formData.get('eventId') ?? '') || null;
  const assigneeIds = formData.getAll('assigneeId').map(String).filter(Boolean);

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié.' };

  const { data: task, error } = await supabase
    .from('tasks')
    .insert({ ...fields, container_id: containerId, parent_task_id: parentTaskId, source_event_id: sourceEventId, created_by: user.id })
    .select('id')
    .single();

  if (error || !task) return { error: 'Impossible de créer la tâche.' };

  if (assigneeIds.length) {
    await supabase.from('task_assignees').insert(assigneeIds.map((user_id) => ({ task_id: task.id, user_id })));
  }

  await syncTaskUpsert(supabase, containerId, task.id);
  revalidateTaskPaths(containerId);
  return {};
}

export async function updateTask(taskId: string, containerId: string, formData: FormData) {
  const fields = parseTaskFields(formData);
  if (!fields.title) return { error: 'Le titre est requis.' };
  const assigneeIds = formData.getAll('assigneeId').map(String).filter(Boolean);

  const supabase = await createClient();
  const { error } = await supabase.from('tasks').update(fields).eq('id', taskId);
  if (error) return { error: 'Impossible de modifier la tâche (droits insuffisants ?).' };

  await supabase.from('task_assignees').delete().eq('task_id', taskId);
  if (assigneeIds.length) {
    await supabase.from('task_assignees').insert(assigneeIds.map((user_id) => ({ task_id: taskId, user_id })));
  }

  await syncTaskUpsert(supabase, containerId, taskId);
  revalidateTaskPaths(containerId);
  return {};
}

export async function deleteTask(taskId: string, containerId: string) {
  const supabase = await createClient();
  await syncTaskDeleted(supabase, containerId, taskId);
  await supabase.from('tasks').delete().eq('id', taskId);
  revalidateTaskPaths(containerId);
}

export async function completeTask(taskId: string, containerId: string, formData: FormData) {
  const comment = String(formData.get('comment') ?? '').trim() || null;
  const photo = formData.get('photo') as File | null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié.' };

  let photoUrl: string | null = null;
  if (photo && photo.size > 0) {
    const path = `${containerId}/${taskId}/${Date.now()}-${photo.name}`;
    const { error: uploadError } = await supabase.storage.from('task-photos').upload(path, photo, { contentType: photo.type });
    if (!uploadError) photoUrl = path;
  }

  const { error } = await supabase.from('task_completions').insert({ task_id: taskId, completed_by: user.id, comment, photo_url: photoUrl });
  if (error) return { error: "Impossible d'enregistrer la complétion (droits insuffisants ?)." };

  await syncTaskDone(supabase, containerId, taskId);
  revalidateTaskPaths(containerId);
  return {};
}

export async function reopenTask(taskId: string, containerId: string) {
  const supabase = await createClient();
  await supabase.from('tasks').update({ status: 'todo' }).eq('id', taskId);
  revalidateTaskPaths(containerId);
}

export async function pauseTask(taskId: string, containerId: string, untilISO: string, reason: string) {
  const supabase = await createClient();
  await supabase.from('tasks').update({ paused_until: untilISO, pause_reason: reason || null }).eq('id', taskId);
  revalidateTaskPaths(containerId);
}

export async function resumeTask(taskId: string, containerId: string) {
  const supabase = await createClient();
  await supabase.from('tasks').update({ paused_until: null, pause_reason: null }).eq('id', taskId);
  revalidateTaskPaths(containerId);
}

export async function rescheduleTask(
  taskId: string,
  containerId: string,
  patch: { due_date?: string; start_at?: string | null; on_calendar?: boolean },
) {
  const supabase = await createClient();
  const { error } = await supabase.from('tasks').update(patch).eq('id', taskId);
  if (error) return { error: 'Impossible de déplacer la tâche.' };
  await syncTaskUpsert(supabase, containerId, taskId);
  revalidateTaskPaths(containerId);
  return {};
}

export async function getTaskPhotoUrl(path: string) {
  const supabase = await createClient();
  const { data } = await supabase.storage.from('task-photos').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
