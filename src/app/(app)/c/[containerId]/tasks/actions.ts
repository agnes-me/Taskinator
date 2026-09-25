'use server';

import { revalidatePath } from 'next/cache';
import { createClient, type SupabaseServerClient } from '@/lib/supabase/server';
import type { Priority, RecurrenceType } from '@/types/database';
import { syncTaskUpsert, syncTaskDone, syncTaskDeleted } from '@/lib/google-task-sync';

function parseTaskFields(formData: FormData) {
  const weekdays = formData.getAll('weekday').join(',');
  const lastCompletedAtDate = String(formData.get('lastCompletedAt') ?? '').trim();
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
    // Permet de corriger directement l'ancre de fraîcheur d'une tâche récurrente (sans passer
    // par une complétion, qui créerait une entrée dans l'historique task_completions).
    last_completed_at: lastCompletedAtDate ? new Date(`${lastCompletedAtDate}T12:00:00`).toISOString() : null,
  };
}

// revalidatePath(`/c/${containerId}`, 'layout') ne suffisait pas : passer un segment dynamique déjà
// résolu (l'UUID du conteneur) avec type 'layout' ne revalide que ce chemin précis, pas les routes
// sœurs comme rooms/[roomId] (un autre segment dynamique plus bas dans l'arborescence) — le roomId
// n'est de toute façon pas connu dans ces actions génériques (deleteTask, completeTask...).
// On revalide donc tout le layout authentifié (app/(app)/layout.tsx), qui englobe toutes les pages
// de l'appli : plus large que nécessaire, mais sans ambiguïté sur ce qui est réellement invalidé.
function revalidateTaskPaths(_containerId: string) {
  revalidatePath('/', 'layout');
}

/**
 * Quand une sous-tâche ponctuelle est cochée et que toutes ses sœurs ponctuelles sont maintenant
 * faites, on complète aussi la tâche parente : sinon (pour un parent récurrent type "Ménage du
 * mercredi" utilisé comme checklist) sa fraîcheur reste bloquée sur sa propre dernière complétion,
 * jamais mise à jour par les sous-tâches, et son échéance n'avance jamais au cycle suivant ; pour
 * un parent ponctuel, elle resterait "à faire" alors que tout son contenu est fait.
 */
async function maybeAutoCompleteParent(supabase: SupabaseServerClient, containerId: string, taskId: string, completedBy: string) {
  const { data: task } = await supabase.from('tasks').select('parent_task_id').eq('id', taskId).maybeSingle();
  const parentId = task?.parent_task_id;
  if (!parentId) return;

  const { data: parent } = await supabase.from('tasks').select('recurrence_type, status').eq('id', parentId).maybeSingle();
  if (!parent) return;
  if (parent.recurrence_type === 'none' && parent.status === 'done') return; // déjà complétée

  const { data: siblings } = await supabase.from('tasks').select('status').eq('parent_task_id', parentId).eq('recurrence_type', 'none');
  if (!siblings || siblings.length === 0 || !siblings.every((s) => s.status === 'done')) return;

  await supabase.from('task_completions').insert({ task_id: parentId, completed_by: completedBy });
  await syncTaskDone(supabase, containerId, parentId);
}

/** Symétrique : décocher une sous-tâche d'un parent ponctuel déjà marqué fait le rouvre aussi. */
async function maybeAutoReopenParent(supabase: SupabaseServerClient, taskId: string) {
  const { data: task } = await supabase.from('tasks').select('parent_task_id').eq('id', taskId).maybeSingle();
  const parentId = task?.parent_task_id;
  if (!parentId) return;

  const { data: parent } = await supabase.from('tasks').select('recurrence_type, status').eq('id', parentId).maybeSingle();
  if (!parent || parent.recurrence_type !== 'none' || parent.status !== 'done') return;

  await supabase.from('tasks').update({ status: 'todo' }).eq('id', parentId);
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
  const completedAtDate = String(formData.get('completedAt') ?? '').trim();

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

  // Permet de "rattraper" une tâche faite plus tôt mais oubliée : si une date est fournie,
  // on l'utilise comme date de complétion (à midi, pour ne pas glisser d'un jour selon le
  // fuseau) au lieu de l'horodatage courant par défaut.
  const completedAt = completedAtDate ? new Date(`${completedAtDate}T12:00:00`).toISOString() : undefined;

  const { error } = await supabase
    .from('task_completions')
    .insert({ task_id: taskId, completed_by: user.id, comment, photo_url: photoUrl, ...(completedAt ? { completed_at: completedAt } : {}) });
  if (error) return { error: "Impossible d'enregistrer la complétion (droits insuffisants ?)." };

  await maybeAutoCompleteParent(supabase, containerId, taskId, user.id);
  await syncTaskDone(supabase, containerId, taskId);
  revalidateTaskPaths(containerId);
  return {};
}

export async function reopenTask(taskId: string, containerId: string) {
  const supabase = await createClient();
  await supabase.from('tasks').update({ status: 'todo' }).eq('id', taskId);
  await maybeAutoReopenParent(supabase, taskId);
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
