import { cache } from 'react';
import type { SupabaseServerClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/user';
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

// Mémoïsé : le layout du conteneur ET chacune de ses pages veulent ce contexte, ce qui
// faisait revalider l'utilisateur et requêter containers/container_members deux fois par
// navigation. cache() ne dédoublonne que pour la requête en cours (par containerId).
export const getContainerContext = cache(async (containerId: string) => {
  const user = await getAuthUser();
  if (!user) return { container: null, role: null };

  const supabase = await createClient();
  const [{ data: container }, { data: membership }] = await Promise.all([
    supabase.from('containers').select('id, name, icon, color, household_id, paused_until, pause_reason').eq('id', containerId).maybeSingle(),
    supabase.from('container_members').select('role').eq('container_id', containerId).eq('user_id', user.id).maybeSingle(),
  ]);

  return { container, role: membership?.role ?? null };
});
