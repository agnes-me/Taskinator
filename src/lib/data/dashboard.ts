import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Priority, RecurrenceType, TaskStatus } from '@/types/database';
import { taskFreshness, aggregateFreshness, type FreshnessResult, type FreshnessTaskLike } from '@/lib/cleanliness';
import { todayISO, sortByDueDate } from '@/lib/utils';

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
  const TASK_FIELDS =
    'id, container_id, parent_task_id, recurrence_type, recurrence_interval, recurrence_weekdays, last_completed_at, freshness_days, paused_until, seasonal_start_month, seasonal_end_month, status, due_date';
  type TaskRow = FreshnessTaskLike & { id: string; container_id: string; parent_task_id: string | null; due_date: string | null };

  // Toutes les tâches racines (récurrentes ET ponctuelles) servent à compiler le nombre à faire/en
  // retard ET la fraîcheur — un conteneur qui n'a que des tâches ponctuelles non cochées ne doit
  // pas afficher 100% pour autant (voir taskFreshness).
  const { data: rootTasksData } = containerIds.length
    ? await supabase.from('tasks').select(TASK_FIELDS).in('container_id', containerIds).is('parent_task_id', null).neq('status', 'cancelled')
    : { data: [] };
  const rootTasks = (rootTasksData ?? []) as unknown as TaskRow[];

  const rootIds = rootTasks.map((t) => t.id);
  const { data: subtaskRows } = rootIds.length
    ? await supabase.from('tasks').select(TASK_FIELDS).in('parent_task_id', rootIds).neq('status', 'cancelled')
    : { data: [] };
  const subtasks = (subtaskRows ?? []) as unknown as TaskRow[];

  return households.map((h) => ({
    id: h.id,
    name: h.name,
    containers: (h.containers ?? []).map((c) => {
      const containerTasks = rootTasks.filter((t) => t.container_id === c.id);
      const results = containerTasks.map((t) => {
        const ownSubtasks = subtasks.filter((s) => s.parent_task_id === t.id);
        return taskFreshness(t, 7, ownSubtasks);
      });
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
  recurrence_type: RecurrenceType;
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
  recurrence_type, recurrence_interval, recurrence_weekdays, last_completed_at, freshness_days,
  paused_until, seasonal_start_month, seasonal_end_month,
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
    recurrence_interval: number;
    recurrence_weekdays: string | null;
    last_completed_at: string | null;
    freshness_days: number | null;
    paused_until: string | null;
    seasonal_start_month: number | null;
    seasonal_end_month: number | null;
    containers: { name: string } | null;
    rooms: { name: string; freshness_days: number } | null;
  };

  const byId = new Map<string, MyTask>();
  const rawById = new Map<string, FreshnessTaskLike>();
  const fallbackDaysById = new Map<string, number>();
  for (const r of rows as unknown as Row[]) {
    rawById.set(r.id, r);
    fallbackDaysById.set(r.id, r.rooms?.freshness_days ?? 7);
    byId.set(r.id, {
      id: r.id,
      title: r.title,
      due_date: r.due_date,
      status: r.status,
      priority: r.priority,
      recurrence_type: r.recurrence_type,
      container_id: r.container_id,
      container_name: r.containers?.name ?? '',
      room_id: r.room_id,
      room_name: r.rooms?.name ?? null,
      freshness: null,
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
  for (const task of byId.values()) task.subtasks = sortByDueDate(task.subtasks);

  // Calculée après la construction de l'arbre : une tâche ponctuelle avec des sous-tâches
  // récurrentes a besoin de connaître ces sous-tâches pour dériver sa propre fraîcheur agrégée
  // (voir taskFreshness — gère aussi le cas d'une tâche ponctuelle sans sous-tâche, en binaire).
  for (const task of byId.values()) {
    const raw = rawById.get(task.id)!;
    const subtaskRaw = task.subtasks.map((s) => rawById.get(s.id)!);
    task.freshness = taskFreshness(raw, fallbackDaysById.get(task.id) ?? 7, subtaskRaw);
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
