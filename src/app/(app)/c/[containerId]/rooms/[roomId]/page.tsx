import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/user';
import { getContainerContext } from '@/lib/data/nav';
import { getContainerMembers } from '@/lib/data/members';
import { listTasks } from '@/lib/data/tasks';
import { TaskListSection } from '@/components/TaskListSection';
import { RoomPauseControl } from './RoomPauseControl';

export default async function RoomPage({ params }: { params: Promise<{ containerId: string; roomId: string }> }) {
  const { containerId, roomId } = await params;
  const supabase = await createClient();
  const user = await getAuthUser();

  const [{ role }, { data: room }, members, tasks] = await Promise.all([
    getContainerContext(containerId),
    supabase.from('rooms').select('id, name, icon, freshness_days, paused_until, pause_reason').eq('id', roomId).maybeSingle(),
    getContainerMembers(supabase, containerId),
    listTasks(supabase, containerId, { roomId }),
  ]);

  if (!room) notFound();
  const canEdit = role === 'admin' || role === 'member';
  const isGuest = role === 'guest';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/c/${containerId}`} className="text-sm text-[var(--text-muted)] hover:underline">
            ← Toutes les pièces
          </Link>
          <h2 className="text-lg font-bold">
            {room.icon} {room.name}
          </h2>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <Link href={`/c/${containerId}/templates?applyTo=${room.id}`} className="btn btn-ghost text-sm">
              Appliquer un template
            </Link>
            <RoomPauseControl containerId={containerId} roomId={room.id} pausedUntil={room.paused_until} />
          </div>
        )}
      </div>

      <TaskListSection
        containerId={containerId}
        tasks={tasks}
        members={members}
        rooms={[{ id: room.id, name: room.name }]}
        currentUserId={user?.id ?? ''}
        isGuest={isGuest}
        canEdit={canEdit}
        fixedRoomId={room.id}
      />
    </div>
  );
}
