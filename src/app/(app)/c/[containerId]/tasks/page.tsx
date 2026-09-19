import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { getContainerContext } from '@/lib/data/nav';
import { getContainerMembers } from '@/lib/data/members';
import { listTasks } from '@/lib/data/tasks';
import { TaskListSection } from '@/components/TaskListSection';

export default async function TasksPage({
  params,
  searchParams,
}: {
  params: Promise<{ containerId: string }>;
  searchParams: Promise<{ room?: string; status?: string }>;
}) {
  const { containerId } = await params;
  const { room, status } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ role }, members, { data: rooms }, tasks] = await Promise.all([
    getContainerContext(supabase, containerId),
    getContainerMembers(supabase, containerId),
    supabase.from('rooms').select('id, name').eq('container_id', containerId).order('sort_order'),
    listTasks(supabase, containerId, {
      roomId: room || undefined,
      status: (status as 'todo' | 'in_progress' | 'done' | 'cancelled') || undefined,
    }),
  ]);

  const canEdit = role === 'admin' || role === 'member';
  const isGuest = role === 'guest';

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2 text-sm">
        <FilterLink containerId={containerId} label="Toutes les pièces" active={!room} params={{ status }} />
        {(rooms ?? []).map((r) => (
          <FilterLink key={r.id} containerId={containerId} label={r.name} active={room === r.id} params={{ room: r.id, status }} />
        ))}
      </div>

      <TaskListSection
        containerId={containerId}
        tasks={tasks}
        members={members}
        rooms={rooms ?? []}
        currentUserId={user?.id ?? ''}
        isGuest={isGuest}
        canEdit={canEdit}
      />
    </div>
  );
}

function FilterLink({
  containerId,
  label,
  active,
  params,
}: {
  containerId: string;
  label: string;
  active: boolean;
  params: Record<string, string | undefined>;
}) {
  const entries = Object.entries(params).filter((entry): entry is [string, string] => Boolean(entry[1]));
  const qs = new URLSearchParams(entries).toString();
  return (
    <Link
      href={`/c/${containerId}/tasks${qs ? `?${qs}` : ''}`}
      className={`chip ${active ? 'bg-container text-white' : 'bg-[var(--surface-muted)]'}`}
    >
      {label}
    </Link>
  );
}
