import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/user';
import { getContainerContext } from '@/lib/data/nav';
import { listRoomTemplates, listEventTemplates } from '@/lib/data/templates';
import { SettingsClient } from './SettingsClient';

export default async function ContainerSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ containerId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { containerId } = await params;
  const { tab } = await searchParams;
  const supabase = await createClient();
  const user = await getAuthUser();

  const [{ role }, roomTemplates, eventTemplates, { data: rooms }, { data: memberRows }, { data: googleAccount }, { data: googleSync }] = await Promise.all([
    getContainerContext(containerId),
    listRoomTemplates(supabase, containerId),
    listEventTemplates(supabase, containerId),
    supabase.from('rooms').select('id, name').eq('container_id', containerId).order('sort_order'),
    supabase.from('container_members').select('id, user_id, role').eq('container_id', containerId),
    supabase.from('google_oauth_accounts').select('user_id').eq('user_id', user?.id ?? '').maybeSingle(),
    supabase.from('container_google_sync').select('google_calendar_id, enabled').eq('container_id', containerId).maybeSingle(),
  ]);

  const canManage = role === 'admin' || role === 'member';

  const userIds = (memberRows ?? []).map((m) => m.user_id);
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id, email, display_name').in('id', userIds)
    : { data: [] };
  const members = (memberRows ?? []).map((m) => {
    const p = profiles?.find((pr) => pr.id === m.user_id);
    return { ...m, email: p?.email ?? '—', display_name: p?.display_name ?? null };
  });
  const isAdmin = members.some((m) => m.user_id === user?.id && m.role === 'admin');

  const { data: invitations } = isAdmin
    ? await supabase
        .from('container_invitations')
        .select('id, token, role, email, expires_at')
        .eq('container_id', containerId)
        .is('accepted_at', null)
        .order('created_at', { ascending: false })
    : { data: [] };

  const system = roomTemplates.filter((t) => t.is_system);
  const containerTpl = roomTemplates.filter((t) => !t.is_system && t.visibility === 'container');
  const personal = roomTemplates.filter((t) => !t.is_system && t.visibility === 'personal' && t.created_by === user?.id);
  const marketplace = roomTemplates.filter((t) => !t.is_system && t.visibility === 'public' && t.moderation_status === 'approved');

  return (
    <SettingsClient
      containerId={containerId}
      initialTab={tab === 'events' ? 'events' : tab === 'members' ? 'members' : tab === 'google' ? 'google' : 'rooms'}
      roomTemplates={{ system, container: containerTpl, personal, marketplace }}
      eventTemplates={eventTemplates}
      rooms={rooms ?? []}
      canManage={canManage}
      currentUserId={user?.id ?? ''}
      members={members}
      invitations={invitations ?? []}
      isAdmin={isAdmin}
      googleConnected={Boolean(googleAccount)}
      googleSync={googleSync ?? null}
    />
  );
}
