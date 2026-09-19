import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

export interface EventSummary {
  id: string;
  name: string;
  event_date: string;
  taskCount: number;
  doneCount: number;
}

export async function listEvents(supabase: SupabaseServerClient, containerId: string): Promise<EventSummary[]> {
  const { data: events } = await supabase
    .from('events')
    .select('id, name, event_date')
    .eq('container_id', containerId)
    .order('event_date', { ascending: false });

  if (!events || events.length === 0) return [];

  const { data: tasks } = await supabase
    .from('tasks')
    .select('source_event_id, status')
    .eq('container_id', containerId)
    .in('source_event_id', events.map((e) => e.id));

  return events.map((e) => {
    const related = (tasks ?? []).filter((t) => t.source_event_id === e.id);
    return { ...e, taskCount: related.length, doneCount: related.filter((t) => t.status === 'done').length };
  });
}
