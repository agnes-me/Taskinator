import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/user';
import { listAllTasksWithDueDates, listAllUnscheduledRecurringTasks } from '@/lib/data/tasks';
import { fetchGoogleEvents } from '@/lib/google-ical';
import { fetchOAuthCalendarEvents } from '@/lib/google-oauth-calendar-fetch';
import { GlobalCalendarClient, type GlobalCalendarEvent } from './GlobalCalendarClient';

export default async function GlobalCalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; week?: string; view?: string; container?: string }>;
}) {
  const { month: monthParam, week: weekParam, view: viewParam, container: containerFilter } = await searchParams;
  const supabase = await createClient();
  const user = await getAuthUser();

  const now = new Date();
  const [yearStr, monthStr] = (monthParam ?? '').split('-');
  const year = Number(yearStr) || now.getFullYear();
  const month = monthStr ? Number(monthStr) - 1 : now.getMonth();
  const view = viewParam === 'month' ? 'month' : 'week';
  const weekAnchor = weekParam || now.toISOString().slice(0, 10);

  const baseDate = view === 'month' ? new Date(year, month, 1) : new Date(`${weekAnchor}T00:00:00`);
  const rangeStart = new Date(baseDate);
  rangeStart.setDate(rangeStart.getDate() - 7);
  const rangeEnd = new Date(baseDate);
  rangeEnd.setDate(rangeEnd.getDate() + (view === 'month' ? 45 : 14));

  const [tasks, unscheduledTasks, { data: events }, { data: subscriptions }, { data: memberships }, { data: households }, oauth, { data: myGoogleCalendars }] =
    await Promise.all([
      listAllTasksWithDueDates(supabase),
      listAllUnscheduledRecurringTasks(supabase),
      supabase.from('events').select('id, name, event_date, container_id, containers(name, icon, color)'),
      supabase.from('ical_subscriptions').select('id, label, url, color, visible').eq('user_id', user?.id ?? '').order('sort_order'),
      supabase.from('container_members').select('container_id, role').eq('user_id', user?.id ?? ''),
      supabase.from('households').select('id, name, containers(id, name, icon, color)').order('created_at', { ascending: true }),
      fetchOAuthCalendarEvents(supabase, user?.id ?? '', rangeStart, rangeEnd),
      supabase.from('google_calendars').select('google_calendar_id, label, color').eq('user_id', user?.id ?? ''),
    ]);

  const visibleSubs = (subscriptions ?? []).filter((sub) => sub.visible);
  const results = await Promise.all(visibleSubs.map(async (sub) => ({ sub, result: await fetchGoogleEvents(sub.url) })));
  const icalEvents = results.flatMap(({ sub, result }) =>
    result.events.map((e) => ({ ...e, id: `${sub.id}:${e.id}`, calendarLabel: sub.label, calendarColor: sub.color })),
  );
  const icalErrors = results.filter(({ result }) => result.error).map(({ sub, result }) => ({ label: sub.label, message: result.error as string }));
  const googleEvents = [...icalEvents, ...oauth.events];
  const googleEventsErrors = [...icalErrors, ...oauth.errors];

  const editableContainerIds = new Set(
    (memberships ?? []).filter((m) => m.role === 'admin' || m.role === 'member').map((m) => m.container_id),
  );
  const containers = (households ?? []).flatMap((h) => h.containers ?? []);

  const allEvents = (events ?? []) as unknown as GlobalCalendarEvent[];
  const filteredTasks = containerFilter ? tasks.filter((t) => t.container_id === containerFilter) : tasks;
  const filteredUnscheduledTasks = containerFilter ? unscheduledTasks.filter((t) => t.container_id === containerFilter) : unscheduledTasks;
  const filteredEvents = containerFilter ? allEvents.filter((e) => e.container_id === containerFilter) : allEvents;

  return (
    <GlobalCalendarClient
      view={view}
      year={year}
      month={month}
      weekAnchor={weekAnchor}
      tasks={filteredTasks}
      unscheduledTasks={filteredUnscheduledTasks}
      events={filteredEvents}
      googleEvents={googleEvents}
      googleEventsErrors={googleEventsErrors}
      containers={containers}
      containerFilter={containerFilter ?? ''}
      editableContainerIds={[...editableContainerIds]}
      myGoogleCalendars={(myGoogleCalendars ?? []).map((c) => ({ googleCalendarId: c.google_calendar_id, label: c.label, color: c.color }))}
    />
  );
}
