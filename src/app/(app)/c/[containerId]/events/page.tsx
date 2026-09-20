import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/user';
import { getContainerContext } from '@/lib/data/nav';
import { listEventTemplates } from '@/lib/data/templates';
import { listEvents } from '@/lib/data/events';
import { EventsClient } from './EventsClient';

export default async function EventsPage({ params }: { params: Promise<{ containerId: string }> }) {
  const { containerId } = await params;
  const supabase = await createClient();
  const user = await getAuthUser();

  const [{ role }, templates, events] = await Promise.all([
    getContainerContext(containerId),
    listEventTemplates(supabase, containerId),
    listEvents(supabase, containerId),
  ]);

  const canManage = role === 'admin' || role === 'member';

  return <EventsClient containerId={containerId} templates={templates} events={events} canManage={canManage} currentUserId={user?.id ?? ''} />;
}
