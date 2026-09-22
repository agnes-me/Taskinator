import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import { taskFreshness, aggregateFreshness, type FreshnessResult, type FreshnessTaskLike } from '@/lib/cleanliness';

export interface RoomWithFreshness {
  id: string;
  name: string;
  icon: string;
  color: string | null;
  freshness_days: number;
  paused_until: string | null;
  pause_reason: string | null;
  taskCount: number;
  freshness: FreshnessResult;
}

export async function getRoomsWithFreshness(supabase: SupabaseServerClient, containerId: string): Promise<RoomWithFreshness[]> {
  const { data: rooms } = await supabase
    .from('rooms')
    .select('id, name, icon, color, freshness_days, paused_until, pause_reason')
    .eq('container_id', containerId)
    .order('sort_order', { ascending: true });

  if (!rooms || rooms.length === 0) return [];

  const TASK_FIELDS =
    'id, room_id, parent_task_id, recurrence_type, recurrence_interval, recurrence_weekdays, last_completed_at, freshness_days, paused_until, seasonal_start_month, seasonal_end_month, status';

  type TaskRow = FreshnessTaskLike & { id: string; room_id: string | null; parent_task_id: string | null };

  // Toutes les tâches racines (récurrentes ET ponctuelles, pas seulement récurrentes) : une pièce
  // qui n'a que des tâches ponctuelles non cochées ne doit pas afficher 100% de fraîcheur pour
  // autant (voir taskFreshness, qui leur donne une fraîcheur binaire faite/à faire).
  const { data: rootTasks } = await supabase
    .from('tasks')
    .select(TASK_FIELDS)
    .eq('container_id', containerId)
    .is('parent_task_id', null)
    .neq('status', 'cancelled')
    .not('room_id', 'is', null);
  const roots = (rootTasks ?? []) as unknown as TaskRow[];

  const rootIds = roots.map((t) => t.id);
  const { data: subtaskRows } = rootIds.length
    ? await supabase.from('tasks').select(TASK_FIELDS).in('parent_task_id', rootIds).neq('status', 'cancelled')
    : { data: [] };
  const subtasks = (subtaskRows ?? []) as unknown as TaskRow[];

  return rooms.map((room) => {
    const roomTasks = roots.filter((t) => t.room_id === room.id);
    const results = roomTasks.map((t) => {
      const ownSubtasks = subtasks.filter((s) => s.parent_task_id === t.id);
      return taskFreshness({ ...t, paused_until: t.paused_until ?? room.paused_until }, room.freshness_days, ownSubtasks);
    });
    const recurringCount = roomTasks.filter((t) => t.recurrence_type !== 'none').length;
    return { ...room, taskCount: recurringCount, freshness: aggregateFreshness(results) };
  });
}
