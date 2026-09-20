import { createClient } from '@/lib/supabase/server';
import { getContainerContext } from '@/lib/data/nav';
import { listTasksWithDueDates } from '@/lib/data/tasks';
import { CalendarClient } from './CalendarClient';

export default async function CalendarPage({
  params,
  searchParams,
}: {
  params: Promise<{ containerId: string }>;
  searchParams: Promise<{ month?: string }>;
}) {
  const { containerId } = await params;
  const { month: monthParam } = await searchParams;
  const supabase = await createClient();

  const [{ role }, tasks, { data: events }] = await Promise.all([
    getContainerContext(containerId),
    listTasksWithDueDates(supabase, containerId),
    supabase.from('events').select('id, name, event_date').eq('container_id', containerId),
  ]);

  const canEdit = role === 'admin' || role === 'member';

  const now = new Date();
  const [yearStr, monthStr] = (monthParam ?? '').split('-');
  const year = Number(yearStr) || now.getFullYear();
  const month = monthStr ? Number(monthStr) - 1 : now.getMonth();

  return (
    <CalendarClient
      containerId={containerId}
      year={year}
      month={month}
      tasks={tasks}
      events={events ?? []}
      canEdit={canEdit}
    />
  );
}
