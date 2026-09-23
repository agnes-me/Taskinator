import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { TaskRow } from '@/lib/data/tasks';
import { sortByDueDate, todayISO } from '@/lib/utils';

export interface EventSummary {
  id: string;
  name: string;
  event_date: string;
  recurrence_type: 'none' | 'yearly';
  nextOccurrence: string;
  taskCount: number;
  doneCount: number;
  tasks: TaskRow[];
}

/** Pour un événement annuel dont la date est passée, calcule la prochaine occurrence (même
 * jour/mois, année suivante) plutôt que de faire disparaître l'événement du planning. */
function computeNextOccurrence(eventDate: string, recurrenceType: 'none' | 'yearly'): string {
  if (recurrenceType !== 'yearly') return eventDate;
  const today = todayISO();
  if (eventDate >= today) return eventDate;
  const [, month, day] = eventDate.split('-');
  const nextYear = Number(today.slice(0, 4)) + (`${today.slice(0, 4)}-${month}-${day}` >= today ? 0 : 1);
  return `${nextYear}-${month}-${day}`;
}

export interface EventsCountSummary {
  total: number;
  upcoming: number;
}

/** Résumé léger (sans les tâches) pour afficher les Événements comme une carte "catégorie" sur la page d'accueil du conteneur. */
export async function getEventsCountSummary(supabase: SupabaseServerClient, containerId: string): Promise<EventsCountSummary> {
  const { data } = await supabase.from('events').select('event_date, recurrence_type').eq('container_id', containerId);
  const today = todayISO();
  const events = data ?? [];
  return { total: events.length, upcoming: events.filter((e) => computeNextOccurrence(e.event_date, e.recurrence_type) >= today).length };
}

export async function listEvents(supabase: SupabaseServerClient, containerId: string, tasks: TaskRow[]): Promise<EventSummary[]> {
  const { data: events } = await supabase
    .from('events')
    .select('id, name, event_date, recurrence_type')
    .eq('container_id', containerId)
    .order('event_date', { ascending: false });

  if (!events || events.length === 0) return [];

  return events.map((e) => {
    const related = sortByDueDate(tasks.filter((t) => t.event?.id === e.id));
    return {
      ...e,
      nextOccurrence: computeNextOccurrence(e.event_date, e.recurrence_type),
      taskCount: related.length,
      doneCount: related.filter((t) => t.status === 'done').length,
      tasks: related,
    };
  });
}
