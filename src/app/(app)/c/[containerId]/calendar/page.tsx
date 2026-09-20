import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/user';
import { getContainerContext } from '@/lib/data/nav';
import { listTasksWithDueDates } from '@/lib/data/tasks';
import { fetchGoogleEvents } from '@/lib/google-ical';
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

  const [{ role }, tasks, { data: events }, { data: rooms }, { data: profile }] = await Promise.all([
    getContainerContext(containerId),
    listTasksWithDueDates(supabase, containerId),
    supabase.from('events').select('id, name, event_date').eq('container_id', containerId),
    supabase.from('rooms').select('id, name, icon').eq('container_id', containerId).order('sort_order'),
    supabase.from('profiles').select('google_ical_url').eq('id', user?.id ?? '').maybeSingle(),
  ]);

  const googleEvents = profile?.google_ical_url ? await fetchGoogleEvents(profile.google_ical_url) : [];

  const canEdit = role === 'admin' || role === 'member';

  const now = new Date();
  const [yearStr, monthStr] = (monthParam ?? '').split('-');
  const year = Number(yearStr) || now.getFullYear();
  const month = monthStr ? Number(monthStr) - 1 : now.getMonth();
  const view = viewParam === 'week' ? 'week' : 'month';
  const weekAnchor = weekParam || now.toISOString().slice(0, 10);

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
      rooms={rooms ?? []}
      roomFilter={roomFilter ?? ''}
      canEdit={canEdit}
    />
  );
}
