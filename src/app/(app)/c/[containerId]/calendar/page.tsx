import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/user';
import { getContainerContext } from '@/lib/data/nav';
import { listTasksWithDueDates } from '@/lib/data/tasks';
import { fetchGoogleEvents } from '@/lib/google-ical';
import { fetchOAuthCalendarEvents } from '@/lib/google-oauth-calendar-fetch';
import { CalendarClient } from './CalendarClient';

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ containerId: string }>;
  searchParams: Promise<{ month?: string; week?: string; view?: string; room?: string }>;
}) {
  const { containerId } = await params;
  const { month: monthParam, week: weekParam, view: viewParam, room: roomFilter } = await searchParams;
  const supabase = await createClient();
  const user = await getAuthUser();

  const now = new Date();
  const [yearStr, monthStr] = (monthParam ?? '').split('-');
  const year = Number(yearStr) || now.getFullYear();
  const month = monthStr ? Number(monthStr) - 1 : now.getMonth();
  const view = viewParam === 'month' ? 'month' : 'week';
  const weekAnchor = weekParam || now.toISOString().slice(0, 10);

  // Fenêtre large plutôt que pile la période affichée : évite un aller-retour Google à chaque
  // clic précédent/suivant proche de la limite de la fenêtre.
  const baseDate = view === 'month' ? new Date(year, month, 1) : new Date(`${weekAnchor}T00:00:00`);
  const rangeStart = new Date(baseDate);
  rangeStart.setDate(rangeStart.getDate() - 7);
  const rangeEnd = new Date(baseDate);
  rangeEnd.setDate(rangeEnd.getDate() + (view === 'month' ? 45 : 14));

  const [{ role }, tasks, { data: events }, { data: rooms }, { data: subscriptions }, oauth] = await Promise.all([
    getContainerContext(containerId),
    listTasksWithDueDates(supabase, containerId),
    supabase.from('events').select('id, name, event_date').eq('container_id', containerId),
    supabase.from('rooms').select('id, name, icon').eq('container_id', containerId).order('sort_order'),
    supabase.from('ical_subscriptions').select('id, label, url, color, visible').eq('user_id', user?.id ?? '').order('sort_order'),
    fetchOAuthCalendarEvents(supabase, user?.id ?? '', rangeStart, rangeEnd),
  ]);

  const visibleSubs = (subscriptions ?? []).filter((sub) => sub.visible);
  const results = await Promise.all(visibleSubs.map(async (sub) => ({ sub, result: await fetchGoogleEvents(sub.url) })));
  const icalEvents = results.flatMap(({ sub, result }) =>
    result.events.map((e) => ({ ...e, id: `${sub.id}:${e.id}`, calendarLabel: sub.label, calendarColor: sub.color })),
  );
  const icalErrors = results.filter(({ result }) => result.error).map(({ sub, result }) => ({ label: sub.label, message: result.error as string }));
  const googleEvents = [...icalEvents, ...oauth.events];
  const googleEventsErrors = [...icalErrors, ...oauth.errors];

  const canEdit = role === 'admin' || role === 'member';

  const filteredTasks = roomFilter ? tasks.filter((t) => t.room_id === roomFilter) : tasks;

  return (
    <CalendarClient
      containerId={containerId}
      view={view}
      year={year}
      month={month}
      weekAnchor={weekAnchor}
      tasks={filteredTasks}
      events={events ?? []}
      googleEvents={googleEvents}
      googleEventsErrors={googleEventsErrors}
      rooms={rooms ?? []}
      roomFilter={roomFilter ?? ''}
      canEdit={canEdit}
    />
  );
}
