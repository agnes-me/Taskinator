import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/user';
import { getContainerContext } from '@/lib/data/nav';
import { getContainerMembers } from '@/lib/data/members';
import { listEventTemplates } from '@/lib/data/templates';
import { listEvents } from '@/lib/data/events';
import { listTasks } from '@/lib/data/tasks';
import { EventsClient } from './EventsClient';

export default async function EventsPage({ params }: { params: Promise<{ containerId: string }> }) {
  const { containerId } = await params;
  const supabase = await createClient();
  const user = await getAuthUser();

  const [{ role }, members, { data: rooms }, allTasks, templates] = await Promise.all([
    getContainerContext(containerId),
    getContainerMembers(supabase, containerId),
    supabase.from('rooms').select('id, name').eq('container_id', containerId).order('sort_order'),
    listTasks(supabase, containerId),
    listEventTemplates(supabase, containerId),
  ]);

  const events = await listEvents(supabase, containerId, allTasks);

  const canManage = role === 'admin' || role === 'member';
  const isGuest = role === 'guest';

  return (
    <EventsClient
      containerId={containerId}
      templates={templates}
      events={events}
      members={members}
      rooms={rooms ?? []}
      canManage={canManage}
      isGuest={isGuest}
      currentUserId={user?.id ?? ''}
    />
  );
}
