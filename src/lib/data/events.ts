import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { TaskRow } from '@/lib/data/tasks';
import { sortByDueDate, todayISO } from '@/lib/utils';

export interface EventSummary {
  id: string;
  name: string;
  event_date: string;
  taskCount: number;
  doneCount: number;
  tasks: TaskRow[];
}

export interface EventsCountSummary {
  total: number;
  upcoming: number;
}

/** Résumé léger (sans les tâches) pour afficher les Événements comme une carte "catégorie" sur la page d'accueil du conteneur. */
export async function getEventsCountSummary(supabase: SupabaseServerClient, containerId: string): Promise<EventsCountSummary> {
  const { data } = await supabase.from('events').select('event_date').eq('container_id', containerId);
  const today = todayISO();
  const events = data ?? [];
  return { total: events.length, upcoming: events.filter((e) => e.event_date >= today).length };
}

export async function listEvents(supabase: SupabaseServerClient, containerId: string, tasks: TaskRow[]): Promise<EventSummary[]> {
  const { data: events } = await supabase
    .from('events')
    .select('id, name, event_date')
    .eq('container_id', containerId)
    .order('event_date', { ascending: false });

  if (!events || events.length === 0) return [];

  return events.map((e) => {
    const related = sortByDueDate(tasks.filter((t) => t.event?.id === e.id));
    return { ...e, taskCount: related.length, doneCount: related.filter((t) => t.status === 'done').length, tasks: related };
  });
}
