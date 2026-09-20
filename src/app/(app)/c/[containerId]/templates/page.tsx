import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/user';
import { getContainerContext } from '@/lib/data/nav';
import { listRoomTemplates } from '@/lib/data/templates';
import { TemplatesClient } from './TemplatesClient';

export default async function TemplatesPage({ params }: { params: Promise<{ containerId: string }> }) {
  const { containerId } = await params;
  const supabase = await createClient();
  const user = await getAuthUser();

  const [{ role }, templates, { data: rooms }] = await Promise.all([
    getContainerContext(containerId),
    listRoomTemplates(supabase, containerId),
    supabase.from('rooms').select('id, name').eq('container_id', containerId).order('sort_order'),
  ]);

  const canManage = role === 'admin' || role === 'member';
  const system = templates.filter((t) => t.is_system);
  const container = templates.filter((t) => !t.is_system && t.visibility === 'container');
  const personal = templates.filter((t) => !t.is_system && t.visibility === 'personal' && t.created_by === user?.id);
  const marketplace = templates.filter((t) => !t.is_system && t.visibility === 'public' && t.moderation_status === 'approved');

  return (
    <TemplatesClient
      containerId={containerId}
      system={system}
      container={container}
      personal={personal}
      marketplace={marketplace}
      rooms={rooms ?? []}
      canManage={canManage}
      currentUserId={user?.id ?? ''}
    />
  );
}
