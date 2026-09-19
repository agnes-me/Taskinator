import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Database } from '@/types/database';

export interface NavContainer {
  id: string;
  name: string;
  icon: string;
  color: string;
}
export interface NavHousehold {
  id: string;
  name: string;
  containers: NavContainer[];
}

export async function getHouseholdsWithContainers(supabase: SupabaseServerClient): Promise<NavHousehold[]> {
  const { data, error } = await supabase
    .from('households')
    .select('id, name, containers(id, name, icon, color)')
    .order('created_at', { ascending: true });

  if (error || !data) return [];
  return data.map((h) => ({ id: h.id, name: h.name, containers: (h.containers ?? []) as NavContainer[] }));
}

export async function getContainerContext(supabase: SupabaseServerClient, containerId: string) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { container: null, role: null };

  const [{ data: container }, { data: membership }] = await Promise.all([
    supabase.from('containers').select('id, name, icon, color, household_id, paused_until, pause_reason').eq('id', containerId).maybeSingle(),
    supabase.from('container_members').select('role').eq('container_id', containerId).eq('user_id', user.id).maybeSingle(),
  ]);

  return { container, role: membership?.role ?? null };
}
