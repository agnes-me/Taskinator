import type { SupabaseServerClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/user';
import type { Database } from '@/types/database';
import { computeFreshness, aggregateFreshness, type FreshnessResult } from '@/lib/cleanliness';
import { todayISO, addDaysISO } from '@/lib/utils';

export interface DashboardContainer {
  id: string;
  name: string;
  icon: string;
  color: string;
  freshness: FreshnessResult;
  openCount: number;
  overdueCount: number;
}
export interface DashboardHousehold {
  id: string;
  name: string;
  containers: DashboardContainer[];
}

export async function getDashboardHouseholds(supabase: SupabaseServerClient): Promise<DashboardHousehold[]> {
  const { data: households } = await supabase
    .from('households')
    .select('id, name, containers(id, name, icon, color)')
    .order('created_at', { ascending: true });

  if (!households) return [];

  const containerIds = households.flatMap((h) => (h.containers ?? []).map((c) => c.id));
  const today = todayISO();
  // Toutes les tâches (récurrentes ou non, y compris celles générées par un événement) servent
  // à compiler le nombre à faire/en retard ; seul le sous-ensemble récurrent sert à la fraîcheur.
  const { data: tasks } = containerIds.length
    ? await supabase
        .from('tasks')
        .select('container_id, recurrence_type, last_completed_at, freshness_days, paused_until, seasonal_start_month, seasonal_end_month, status, due_date')
        .in('container_id', containerIds)
        .is('parent_task_id', null)
        .neq('status', 'cancelled')
    : { data: [] };

  return households.map((h) => ({
    id: h.id,
    name: h.name,
    containers: (h.containers ?? []).map((c) => {
      const containerTasks = (tasks ?? []).filter((t) => t.container_id === c.id);
      const recurringTasks = containerTasks.filter((t) => t.recurrence_type !== 'none');
      const results = recurringTasks.map((t) =>
        computeFreshness({
          lastCompletedAt: t.last_completed_at,
          freshnessDays: t.freshness_days ?? 7,
          pausedUntil: t.paused_until,
          seasonalStartMonth: t.seasonal_start_month,
          seasonalEndMonth: t.seasonal_end_month,
        }),
      );
      const openTasks = containerTasks.filter((t) => t.status === 'todo' || t.status === 'in_progress');
      const overdueCount = openTasks.filter((t) => t.due_date && t.due_date < today).length;
      return { ...c, freshness: aggregateFreshness(results), openCount: openTasks.length, overdueCount };
    }),
  }));
}

export interface MyTask {
  id: string;
  title: string;
  due_date: string | null;
  container_id: string;
  container_name: string;
  priority: string;
}

export async function getMyUpcomingTasks(supabase: SupabaseServerClient): Promise<MyTask[]> {
  const user = await getAuthUser();
  if (!user) return [];

  const { data: assigned } = await supabase.from('task_assignees').select('task_id').eq('user_id', user.id);
  const taskIds = (assigned ?? []).map((a) => a.task_id);
  if (taskIds.length === 0) return [];

  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, due_date, priority, container_id, containers(name)')
    .in('id', taskIds)
    .neq('status', 'done')
    .neq('status', 'cancelled')
    .lte('due_date', addDaysISO(todayISO(), 7))
    .order('due_date', { ascending: true });

  return (tasks ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    due_date: t.due_date,
    priority: t.priority,
    container_id: t.container_id,
    container_name: (t.containers as unknown as { name: string } | null)?.name ?? '',
  }));
}
