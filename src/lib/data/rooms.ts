import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import { computeFreshness, aggregateFreshness, type FreshnessResult } from '@/lib/cleanliness';
import { defaultFreshnessDaysFromRecurrence } from '@/lib/recurrence';

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

  const { data: tasks } = await supabase
    .from('tasks')
    .select(
      'room_id, recurrence_type, recurrence_interval, recurrence_weekdays, last_completed_at, freshness_days, paused_until, seasonal_start_month, seasonal_end_month, status',
    )
    .eq('container_id', containerId)
    .is('parent_task_id', null)
    .neq('status', 'cancelled')
    .neq('recurrence_type', 'none')
    .not('room_id', 'is', null);

  return rooms.map((room) => {
    const roomTasks = (tasks ?? []).filter((t) => t.room_id === room.id);
    const results = roomTasks.map((t) =>
      computeFreshness({
        lastCompletedAt: t.last_completed_at,
        freshnessDays:
          t.freshness_days ??
          defaultFreshnessDaysFromRecurrence(t.recurrence_type, t.recurrence_interval, t.recurrence_weekdays) ??
          room.freshness_days,
        pausedUntil: t.paused_until ?? room.paused_until,
        seasonalStartMonth: t.seasonal_start_month,
        seasonalEndMonth: t.seasonal_end_month,
      }),
    );
    return { ...room, taskCount: roomTasks.length, freshness: aggregateFreshness(results) };
  });
}
