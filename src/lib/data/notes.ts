import type { SupabaseServerClient } from '@/lib/supabase/server';

export interface ContainerNotes {
  content: string;
  updated_at: string | null;
  updated_by_name: string | null;
}

export async function getContainerNotes(supabase: SupabaseServerClient, containerId: string): Promise<ContainerNotes> {
  const { data } = await supabase.from('container_notes').select('content, updated_at, updated_by').eq('container_id', containerId).maybeSingle();
  if (!data) return { content: '', updated_at: null, updated_by_name: null };

  let updatedByName: string | null = null;
  if (data.updated_by) {
    const { data: profile } = await supabase.from('profiles').select('email, display_name').eq('id', data.updated_by).maybeSingle();
    updatedByName = profile?.display_name ?? profile?.email ?? null;
  }

  return { content: data.content, updated_at: data.updated_at, updated_by_name: updatedByName };
}
