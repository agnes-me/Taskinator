import type { SupabaseServerClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/user';
import type { Database } from '@/types/database';
import { computeFreshness, aggregateFreshness, type FreshnessResult } from '@/lib/cleanliness';
import { todayISO } from '@/lib/utils';

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
  room_id: string | null;
  room_name: string | null;
  priority: string;
}

export interface MyTaskFilters {
  containerId?: string;
  roomId?: string;
  priority?: string;
  dueBefore?: string;
}

export async function getMyUpcomingTasks(supabase: SupabaseServerClient, filters: MyTaskFilters = {}): Promise<MyTask[]> {
  const user = await getAuthUser();
  if (!user) return [];

  // Ne filtre plus par assignation nommée (table task_assignees) : de nombreux foyers n'assignent
  // jamais une tâche à quelqu'un en particulier, un filtre par assigné renvoyait alors
  // systématiquement une liste vide quelle que soit l'échéance. Ne filtre plus non plus sur une
  // fenêtre fixe de 7 jours, pour qu'une tâche d'événement à échéance dans plusieurs mois reste
  // "à venir". RLS restreint déjà aux tâches des conteneurs dont l'utilisateur est membre.
  let query = supabase
    .from('tasks')
    .select('id, title, due_date, priority, container_id, room_id, containers(name), rooms(name)')
    .is('parent_task_id', null)
    .not('due_date', 'is', null)
    .neq('status', 'done')
    .neq('status', 'cancelled')
    .order('due_date', { ascending: true })
    .limit(100);

  if (filters.containerId) query = query.eq('container_id', filters.containerId);
  if (filters.roomId) query = query.eq('room_id', filters.roomId);
  if (filters.priority) query = query.eq('priority', filters.priority);
  if (filters.dueBefore) query = query.lte('due_date', filters.dueBefore);

  const { data: tasks } = await query;

  return (tasks ?? []).map((t) => ({
    id: t.id,
    title: t.title,
    due_date: t.due_date,
    priority: t.priority,
    container_id: t.container_id,
    container_name: (t.containers as unknown as { name: string } | null)?.name ?? '',
    room_id: t.room_id,
    room_name: (t.rooms as unknown as { name: string } | null)?.name ?? null,
  }));
}

export interface RoomOption {
  id: string;
  name: string;
  container_id: string;
}

export async function getDashboardRoomOptions(supabase: SupabaseServerClient, containerIds: string[]): Promise<RoomOption[]> {
  if (!containerIds.length) return [];
  const { data } = await supabase.from('rooms').select('id, name, container_id').in('container_id', containerIds).order('name');
  return data ?? [];
}
