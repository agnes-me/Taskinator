import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Database, Priority, RecurrenceType, TaskStatus } from '@/types/database';
import { computeFreshness, type FreshnessResult } from '@/lib/cleanliness';

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
  assignees: { user_id: string; email: string; display_name: string | null }[];
  subtasks: TaskRow[];
  freshness: FreshnessResult | null;
}

const TASK_SELECT = `
  id, container_id, room_id, parent_task_id, title, description, status, priority,
  recurrence_type, recurrence_interval, recurrence_weekdays, due_date, start_at, duration_minutes,
  on_calendar, freshness_days, last_completed_at, completion_mode,
  seasonal_start_month, seasonal_end_month, paused_until, pause_reason,
  room:rooms(id, name, icon, freshness_days)
`;

export async function listTasks(
  supabase: SupabaseServerClient,
  containerId: string,
  filters: { roomId?: string; status?: TaskStatus } = {},
): Promise<TaskRow[]> {
  let query = supabase.from('tasks').select(TASK_SELECT).eq('container_id', containerId).order('sort_order', { ascending: true });
  if (filters.roomId) query = query.eq('room_id', filters.roomId);
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
    const freshness =
      r.recurrence_type !== 'none' && !r.parent_task_id
        ? computeFreshness({
            lastCompletedAt: r.last_completed_at,
            freshnessDays: r.freshness_days ?? r.room?.freshness_days ?? 7,
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
  return roots;
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
