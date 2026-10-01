'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function createContainer(householdId: string, formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const icon = String(formData.get('icon') ?? '🏠');
  const color = String(formData.get('color') ?? '#14b8a6');
  if (!name) return { error: 'Le nom est requis.' };

  const supabase = await createClient();
  const { data: containerId, error } = await supabase.rpc('create_container', {
    p_household_id: householdId,
    p_name: name,
    p_icon: icon,
    p_color: color,
  });

  if (error || !containerId) return { error: 'Impossible de créer le conteneur.' };
  revalidatePath('/dashboard');
  redirect(`/c/${containerId}`);
}
