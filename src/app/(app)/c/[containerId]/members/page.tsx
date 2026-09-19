import { createClient } from '@/lib/supabase/server';
import { MembersClient } from './MembersClient';

export default async function MembersPage({ params }: { params: Promise<{ containerId: string }> }) {
  const { containerId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: memberRows } = await supabase
    .from('container_members')
    .select('id, user_id, role')
    .eq('container_id', containerId);

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

  return (
    <MembersClient
      containerId={containerId}
      members={members}
      invitations={invitations ?? []}
      currentUserId={user?.id ?? ''}
      isAdmin={isAdmin}
    />
  );
}
