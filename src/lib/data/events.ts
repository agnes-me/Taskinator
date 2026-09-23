import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { TaskRow } from '@/lib/data/tasks';
import type { EventRecurrenceType } from '@/types/database';
import { sortByDueDate, todayISO } from '@/lib/utils';

export interface EventSummary {
  id: string;
  name: string;
  event_date: string;
  recurrence_type: EventRecurrenceType;
  nextOccurrence: string;
  taskCount: number;
  doneCount: number;
  tasks: TaskRow[];
}

/** Pour un événement périodique dont la date est passée, calcule la prochaine occurrence
 * (même jour de semaine/mois/année) plutôt que de faire disparaître l'événement du planning. */
function computeNextOccurrence(eventDate: string, recurrenceType: EventRecurrenceType): string {
  if (recurrenceType === 'none') return eventDate;
  const today = todayISO();
  if (eventDate >= today) return eventDate;

  const d = new Date(`${eventDate}T12:00:00Z`);
  const todayD = new Date(`${today}T12:00:00Z`);
  while (d < todayD) {
    if (recurrenceType === 'weekly') d.setUTCDate(d.getUTCDate() + 7);
    else if (recurrenceType === 'monthly') d.setUTCMonth(d.getUTCMonth() + 1);
    else d.setUTCFullYear(d.getUTCFullYear() + 1);
  }
  return d.toISOString().slice(0, 10);
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
