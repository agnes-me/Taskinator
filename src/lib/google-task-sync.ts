import type { SupabaseServerClient } from '@/lib/supabase/server';
import { getValidAccessToken } from '@/lib/google-oauth';
import { createEvent, updateEvent, deleteEvent } from '@/lib/google-calendar-api';

/**
 * Déversement automatique des tâches d'un conteneur vers un agenda Google choisi
 * (container_google_sync). Toutes les fonctions ici sont best-effort : une panne de l'API Google
 * ne doit jamais faire échouer l'action sur la tâche elle-même (créer/modifier/terminer/supprimer
 * une tâche doit marcher même si Google est indisponible ou la synchro mal configurée).
 */

interface SyncTarget {
  googleCalendarId: string;
  accessToken: string;
}

async function getSyncTarget(supabase: SupabaseServerClient, containerId: string): Promise<SyncTarget | null> {
  const { data: sync } = await supabase
    .from('container_google_sync')
    .select('google_calendar_id, synced_by, enabled')
    .eq('container_id', containerId)
    .maybeSingle();
  if (!sync || !sync.enabled) return null;

  const token = await getValidAccessToken(supabase, sync.synced_by);
  if (!token) return null;
  return { googleCalendarId: sync.google_calendar_id, accessToken: token };
}

interface TaskForSync {
  id: string;
  title: string;
  due_date: string | null;
  start_at: string | null;
  duration_minutes: number | null;
  recurrence_type: string;
}

function eventTimingFor(task: TaskForSync): { startISO: string; endISO: string; allDay: boolean } | null {
  if (task.start_at) {
    const start = new Date(task.start_at);
    const end = new Date(start.getTime() + (task.duration_minutes ?? 30) * 60000);
    return { startISO: start.toISOString(), endISO: end.toISOString(), allDay: false };
  }
  if (task.due_date) {
    const end = new Date(`${task.due_date}T00:00:00`);
    end.setDate(end.getDate() + 1);
    return { startISO: `${task.due_date}T00:00:00`, endISO: `${end.toISOString().slice(0, 10)}T00:00:00`, allDay: true };
  }
  return null;
}

/** Crée ou met à jour l'événement Google mappé à cette tâche (appelé à la création/modification/déplacement). */
export async function syncTaskUpsert(supabase: SupabaseServerClient, containerId: string, taskId: string) {
  const target = await getSyncTarget(supabase, containerId);
  if (!target) return;

  const { data: task } = await supabase
    .from('tasks')
    .select('id, title, due_date, start_at, duration_minutes, recurrence_type')
    .eq('id', taskId)
    .maybeSingle();
  if (!task) return;
  const timing = eventTimingFor(task);
  if (!timing) return; // pas d'échéance connue -> rien de sensé à pousser sur un calendrier

  const { data: mapping } = await supabase.from('task_google_events').select('google_event_id').eq('task_id', taskId).maybeSingle();

  try {
    if (mapping) {
      await updateEvent(target.accessToken, target.googleCalendarId, mapping.google_event_id, { summary: task.title, ...timing });
    } else {
      const created = await createEvent(target.accessToken, target.googleCalendarId, { summary: task.title, ...timing });
      await supabase.from('task_google_events').insert({ task_id: taskId, container_id: containerId, google_event_id: created.id });
    }
  } catch {
    // best-effort
  }
}

/** Tâche terminée : événement conservé et titre préfixé "✅" — sauf récurrente, qui repart pour une prochaine échéance. */
export async function syncTaskDone(supabase: SupabaseServerClient, containerId: string, taskId: string) {
  const target = await getSyncTarget(supabase, containerId);
  if (!target) return;

  const { data: task } = await supabase.from('tasks').select('id, title, recurrence_type').eq('id', taskId).maybeSingle();
  if (!task) return;

  if (task.recurrence_type !== 'none') {
    await syncTaskUpsert(supabase, containerId, taskId);
    return;
  }

  const { data: mapping } = await supabase.from('task_google_events').select('google_event_id').eq('task_id', taskId).maybeSingle();
  if (!mapping) return;

  try {
    await updateEvent(target.accessToken, target.googleCalendarId, mapping.google_event_id, { summary: `✅ ${task.title}` });
  } catch {
    // best-effort
  }
}

/** Tâche (ou événement Taskinator) supprimée : l'événement Google correspondant est supprimé, pas juste relabellisé. */
export async function syncTaskDeleted(supabase: SupabaseServerClient, containerId: string, taskId: string) {
  const target = await getSyncTarget(supabase, containerId);
  const { data: mapping } = await supabase.from('task_google_events').select('google_event_id').eq('task_id', taskId).maybeSingle();

  if (target && mapping) {
    try {
      await deleteEvent(target.accessToken, target.googleCalendarId, mapping.google_event_id);
    } catch {
      // best-effort
    }
  }
  if (mapping) {
    await supabase.from('task_google_events').delete().eq('task_id', taskId);
  }
}
