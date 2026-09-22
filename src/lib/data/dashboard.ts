import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Priority, RecurrenceType, TaskStatus } from '@/types/database';
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
  status: TaskStatus;
  priority: Priority;
  container_id: string;
  container_name: string;
  room_id: string | null;
  room_name: string | null;
  freshness: FreshnessResult | null;
  subtasks: MyTask[];
}

export interface MyTaskFilters {
  containerId?: string;
  roomId?: string;
  priority?: string;
  dueBefore?: string;
}

const MY_TASK_SELECT = `
  id, title, due_date, status, priority, container_id, room_id, parent_task_id,
  recurrence_type, last_completed_at, freshness_days, paused_until, seasonal_start_month, seasonal_end_month,
  containers(name), rooms(name, freshness_days)
`;

// Toutes les tâches (récurrentes ou non, datées ou non, y compris les sous-tâches) des
// conteneurs de l'utilisateur, en arbre parent/enfant, avec la fraîcheur par tâche récurrente.
// Comme pour listTasks() (rooms/[roomId]), le filtre par pièce/difficulté/échéance ne doit
// s'appliquer qu'aux tâches racines : une sous-tâche n'a pas forcément le room_id ou la
// difficulté de sa tâche parente, et l'exclure de la requête SQL casserait le lien parent/enfant.
export async function getMyAllTasks(supabase: SupabaseServerClient, containerIds: string[], filters: MyTaskFilters = {}): Promise<MyTask[]> {
  if (containerIds.length === 0) return [];

  let query = supabase
    .from('tasks')
    .select(MY_TASK_SELECT)
    .in('container_id', containerIds)
    .neq('status', 'cancelled')
    .order('due_date', { ascending: true, nullsFirst: false });

  if (filters.containerId) query = query.eq('container_id', filters.containerId);

  const { data: rows } = await query;
  if (!rows) return [];

  type Row = {
    id: string;
    title: string;
    due_date: string | null;
    status: TaskStatus;
    priority: Priority;
    container_id: string;
    room_id: string | null;
    parent_task_id: string | null;
    recurrence_type: RecurrenceType;
    last_completed_at: string | null;
    freshness_days: number | null;
    paused_until: string | null;
    seasonal_start_month: number | null;
    seasonal_end_month: number | null;
    containers: { name: string } | null;
    rooms: { name: string; freshness_days: number } | null;
  };

  const byId = new Map<string, MyTask>();
  for (const r of rows as unknown as Row[]) {
    const freshness =
      r.recurrence_type !== 'none' && !r.parent_task_id
        ? computeFreshness({
            lastCompletedAt: r.last_completed_at,
            freshnessDays: r.freshness_days ?? r.rooms?.freshness_days ?? 7,
            pausedUntil: r.paused_until,
            seasonalStartMonth: r.seasonal_start_month,
            seasonalEndMonth: r.seasonal_end_month,
          })
        : null;
    byId.set(r.id, {
      id: r.id,
      title: r.title,
      due_date: r.due_date,
      status: r.status,
      priority: r.priority,
      container_id: r.container_id,
      container_name: r.containers?.name ?? '',
      room_id: r.room_id,
      room_name: r.rooms?.name ?? null,
      freshness,
      subtasks: [],
    });
  }

  const roots: MyTask[] = [];
  for (const r of rows as unknown as Row[]) {
    const task = byId.get(r.id)!;
    if (r.parent_task_id && byId.has(r.parent_task_id)) {
      byId.get(r.parent_task_id)!.subtasks.push(task);
    } else {
      roots.push(task);
    }
  }

  let filteredRoots = roots;
  if (filters.roomId) filteredRoots = filteredRoots.filter((t) => t.room_id === filters.roomId);
  if (filters.priority) filteredRoots = filteredRoots.filter((t) => t.priority === filters.priority);
  if (filters.dueBefore) filteredRoots = filteredRoots.filter((t) => t.due_date && t.due_date <= filters.dueBefore!);

  return filteredRoots;
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
