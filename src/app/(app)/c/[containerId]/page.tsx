import { createClient } from '@/lib/supabase/server';
import { getContainerContext } from '@/lib/data/nav';
import { getRoomsWithFreshness } from '@/lib/data/rooms';
import { RoomsClient } from './RoomsClient';

export default async function ContainerHomePage({ params }: { params: Promise<{ containerId: string }> }) {
  const { containerId } = await params;
  const supabase = await createClient();
  const [{ container, role }, rooms] = await Promise.all([
    getContainerContext(supabase, containerId),
    getRoomsWithFreshness(supabase, containerId),
  ]);

  const canEdit = role === 'admin' || role === 'member';

  return (
    <RoomsClient containerId={containerId} rooms={rooms} canEdit={canEdit} containerPausedUntil={container?.paused_until ?? null} />
  );
}
