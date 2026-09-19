'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function createFirstHousehold(_prevState: { error: string | null }, formData: FormData) {
  const householdName = String(formData.get('householdName') ?? '').trim();
  const containerName = String(formData.get('containerName') ?? '').trim();
  const containerIcon = String(formData.get('containerIcon') ?? '🏠');
  const containerColor = String(formData.get('containerColor') ?? '#14b8a6');

  if (!householdName || !containerName) {
    return { error: 'Le nom du foyer et du premier conteneur sont requis.' };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('create_household_with_container', {
    p_household_name: householdName,
    p_container_name: containerName,
    p_container_icon: containerIcon,
    p_container_color: containerColor,
  });

  if (error || !data?.[0]) {
    return { error: "Impossible de créer le foyer. Réessayez." };
  }

  redirect(`/c/${data[0].container_id}`);
}
