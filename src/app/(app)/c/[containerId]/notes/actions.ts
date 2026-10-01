'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function updateContainerNotes(containerId: string, content: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié.' };

  const { error } = await supabase
    .from('container_notes')
    .upsert({ container_id: containerId, content, updated_by: user.id, updated_at: new Date().toISOString() });
  if (error) return { error: "Impossible d'enregistrer les notes (droits insuffisants ?)." };

  revalidatePath(`/c/${containerId}/notes`);
  return {};
}
