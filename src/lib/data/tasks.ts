import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Database, Priority, RecurrenceType, TaskStatus } from '@/types/database';
import { computeFreshness, aggregateFreshness, type FreshnessResult } from '@/lib/cleanliness';
import { sortByDueDate } from '@/lib/utils';
import { defaultFreshnessDaysFromRecurrence } from '@/lib/recurrence';

export interface TaskRow {
  id: string;
  container_id: string;
  room_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: Priority;
  recurrence_type: RecurrenceType;
  recurrence_interval: number;
  recurrence_weekdays: string | null;
  due_date: string | null;
  start_at: string | null;
  duration_minutes: number | null;
  on_calendar: boolean;
  freshness_days: number | null;
  last_completed_at: string | null;
  completion_mode: 'manual' | 'auto_from_subtasks';
  seasonal_start_month: number | null;
  seasonal_end_month: number | null;
  paused_until: string | null;
  pause_reason: string | null;
  room?: { id: string; name: string; icon: string; freshness_days: number } | null;
  event?: { id: string; name: string } | null;
  assignees: { user_id: string; email: string; display_name: string | null }[];
  subtasks: TaskRow[];
  freshness: FreshnessResult | null;
}

const TASK_SELECT = `
  id, container_id, room_id, parent_task_id, title, description, status, priority,
  recurrence_type, recurrence_interval, recurrence_weekdays, due_date, start_at, duration_minutes,
  on_calendar, freshness_days, last_completed_at, completion_mode,
  seasonal_start_month, seasonal_end_month, paused_until, pause_reason,
  room:rooms(id, name, icon, freshness_days),
  event:events!tasks_source_event_id_fkey(id, name)
`;

export async function listTasks(
  supabase: SupabaseServerClient,
  containerId: string,
  filters: { roomId?: string; status?: TaskStatus } = {},
): Promise<TaskRow[]> {
  let query = supabase.from('tasks').select(TASK_SELECT).eq('container_id', containerId).order('sort_order', { ascending: true });
  if (filters.status) query = query.eq('status', filters.status);

  const { data: rows } = await query;
  if (!rows) return [];

  const ids = rows.map((r) => r.id);
  const [{ data: assignees }, { data: profiles }] = await Promise.all([
    ids.length ? supabase.from('task_assignees').select('task_id, user_id').in('task_id', ids) : Promise.resolve({ data: [] }),
    supabase.from('profiles').select('id, email, display_name'),
  ]);

  const byId = new Map<string, TaskRow>();
  for (const r of rows as unknown as (Omit<TaskRow, 'assignees' | 'subtasks' | 'freshness'> & { room: TaskRow['room'] })[]) {
    const rowAssignees = (assignees ?? [])
      .filter((a) => a.task_id === r.id)
      .map((a) => {
        const p = profiles?.find((pr) => pr.id === a.user_id);
        return { user_id: a.user_id, email: p?.email ?? '—', display_name: p?.display_name ?? null };
      });
    // Calculée pour toute tâche récurrente, y compris une sous-tâche (auparavant réservée aux
    // racines) : une sous-tâche récurrente a son propre cycle de fraîcheur, et sert aussi
    // d'entrée à la fraîcheur agrégée de sa tâche parente ci-dessous.
    const freshness =
      r.recurrence_type !== 'none'
        ? computeFreshness({
            lastCompletedAt: r.last_completed_at,
            freshnessDays:
              r.freshness_days ??
              defaultFreshnessDaysFromRecurrence(r.recurrence_type, r.recurrence_interval, r.recurrence_weekdays) ??
              r.room?.freshness_days ??
              7,
            pausedUntil: r.paused_until,
            seasonalStartMonth: r.seasonal_start_month,
            seasonalEndMonth: r.seasonal_end_month,
          })
        : null;
    byId.set(r.id, { ...r, assignees: rowAssignees, subtasks: [], freshness });
  }

  const roots: TaskRow[] = [];
  for (const task of byId.values()) {
    if (task.parent_task_id && byId.has(task.parent_task_id)) {
      byId.get(task.parent_task_id)!.subtasks.push(task);
    } else {
      roots.push(task);
    }
  }
  // Les sous-tâches se lisent comme une checklist chronologique : triées par échéance plutôt
  // que par sort_order (ordre de création), qui n'a pas de sens pour l'utilisateur ici.
  for (const task of byId.values()) task.subtasks = sortByDueDate(task.subtasks);

  // Une tâche ponctuelle (non récurrente) qui a des sous-tâches récurrentes affiche la moyenne de
  // leur fraîcheur plutôt qu'aucune barre : c'est le cas typique d'une tâche "conteneur" (ex.
  // "Ménage complet") dont chaque sous-tâche a son propre cycle. Une tâche elle-même récurrente
  // garde son propre suivi (ne pas mélanger les deux sources de vérité).
  for (const task of byId.values()) {
    if (task.recurrence_type === 'none' && task.subtasks.length > 0) {
      const subFreshness = task.subtasks.map((s) => s.freshness).filter((f): f is FreshnessResult => f !== null);
      if (subFreshness.length > 0) task.freshness = aggregateFreshness(subFreshness);
    }
  }

  // Le filtre par pièce ne s'applique qu'aux tâches racines : une sous-tâche n'a pas forcément
  // le room_id de sa pièce (elle hérite de sa tâche parente), donc on ne doit jamais l'exclure
  // de la requête SQL au risque de casser le lien parent/enfant.
  return filters.roomId ? roots.filter((t) => t.room_id === filters.roomId) : roots;
}

export interface CalendarTask {
  id: string;
  title: string;
  due_date: string;
  start_at: string | null;
  on_calendar: boolean;
  priority: Priority;
  status: TaskStatus;
  room_id: string | null;
  room: { icon: string; name: string } | null;
  event: { name: string } | null;
}

export async function listTasksWithDueDates(supabase: SupabaseServerClient, containerId: string): Promise<CalendarTask[]> {
  const { data } = await supabase
    .from('tasks')
    .select(
      'id, title, due_date, start_at, on_calendar, priority, status, room_id, room:rooms(icon, name), event:events!tasks_source_event_id_fkey(name)',
    )
    .eq('container_id', containerId)
    .not('due_date', 'is', null)
    .is('parent_task_id', null)
    .neq('status', 'cancelled');

  return (data ?? []) as unknown as CalendarTask[];
}

export interface GlobalCalendarTask extends CalendarTask {
  container_id: string;
  container: { id: string; name: string; icon: string; color: string } | null;
}

/** Comme listTasksWithDueDates, mais tous conteneurs confondus (RLS restreint déjà à ceux dont l'utilisateur est membre) — pour la vue calendrier globale. */
export async function listAllTasksWithDueDates(supabase: SupabaseServerClient): Promise<GlobalCalendarTask[]> {
  const { data } = await supabase
    .from('tasks')
    .select(
      'id, title, due_date, start_at, on_calendar, priority, status, room_id, container_id, room:rooms(icon, name), event:events!tasks_source_event_id_fkey(name), container:containers(id, name, icon, color)',
    )
    .not('due_date', 'is', null)
    .is('parent_task_id', null)
    .neq('status', 'cancelled');

  return (data ?? []) as unknown as GlobalCalendarTask[];
}

export interface UnscheduledTask {
  id: string;
  title: string;
  priority: Priority;
  status: TaskStatus;
  room_id: string | null;
  room: { icon: string; name: string } | null;
}

// Tâches récurrentes sans due_date : invisibles du calendrier (qui n'indexe que par date), donc
// listées à part pour être proposées en glisser-déposer sur un jour (planification manuelle).
export async function listUnscheduledRecurringTasks(supabase: SupabaseServerClient, containerId: string): Promise<UnscheduledTask[]> {
  const { data } = await supabase
    .from('tasks')
    .select('id, title, priority, status, room_id, room:rooms(icon, name)')
    .eq('container_id', containerId)
    .is('due_date', null)
    .is('parent_task_id', null)
    .neq('recurrence_type', 'none')
    .neq('status', 'cancelled');

  return (data ?? []) as unknown as UnscheduledTask[];
}

export interface GlobalUnscheduledTask extends UnscheduledTask {
  container_id: string;
  container: { id: string; name: string; icon: string; color: string } | null;
}

export async function listAllUnscheduledRecurringTasks(supabase: SupabaseServerClient): Promise<GlobalUnscheduledTask[]> {
  const { data } = await supabase
    .from('tasks')
    .select('id, title, priority, status, room_id, container_id, room:rooms(icon, name), container:containers(id, name, icon, color)')
    .is('due_date', null)
    .is('parent_task_id', null)
    .neq('recurrence_type', 'none')
    .neq('status', 'cancelled');

  return (data ?? []) as unknown as GlobalUnscheduledTask[];
}

export async function getTaskWithHistory(supabase: SupabaseServerClient, taskId: string) {
  const { data: task } = await supabase.from('tasks').select(TASK_SELECT).eq('id', taskId).maybeSingle();
  const { data: completions } = await supabase
    .from('task_completions')
    .select('id, completed_by, completed_at, comment, photo_url')
    .eq('task_id', taskId)
    .order('completed_at', { ascending: false });
  return { task, completions: completions ?? [] };
}
