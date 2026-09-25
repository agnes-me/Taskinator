import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

export async function getContainerMembers(supabase: SupabaseServerClient, containerId: string) {
  const { data: rows } = await supabase.from('container_members').select('user_id').eq('container_id', containerId);
  const ids = (rows ?? []).map((r) => r.user_id);
  if (ids.length === 0) return [];
  const { data: profiles } = await supabase.from('profiles').select('id, email, display_name').in('id', ids);
  return ids.map((id) => {
    const p = profiles?.find((pr) => pr.id === id);
    return { user_id: id, email: p?.email ?? '—', display_name: p?.display_name ?? null };
  });
}
