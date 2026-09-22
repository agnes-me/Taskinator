'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function createRoom(containerId: string, formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const icon = String(formData.get('icon') ?? '🧹');
  const freshnessDays = Number(formData.get('freshnessDays') ?? 7);
  if (!name) return { error: 'Le nom de la catégorie est requis.' };

  const supabase = await createClient();
  const { error } = await supabase.from('rooms').insert({
    container_id: containerId,
    name,
    icon,
    freshness_days: Number.isFinite(freshnessDays) && freshnessDays > 0 ? freshnessDays : 7,
  });
  if (error) return { error: 'Impossible de créer la catégorie.' };
  revalidatePath(`/c/${containerId}`);
  return {};
}

export async function updateRoom(containerId: string, roomId: string, formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const icon = String(formData.get('icon') ?? '🧹');
  if (!name) return { error: 'Le nom de la catégorie est requis.' };

  const supabase = await createClient();
  const { error } = await supabase.from('rooms').update({ name, icon }).eq('id', roomId);
  if (error) return { error: 'Impossible de modifier la catégorie (droits insuffisants ?).' };
  revalidatePath(`/c/${containerId}`);
  return {};
}

export async function deleteRoom(containerId: string, roomId: string) {
  const supabase = await createClient();
  await supabase.from('rooms').delete().eq('id', roomId);
  revalidatePath(`/c/${containerId}`);
}

export async function pauseRoom(containerId: string, roomId: string, untilISO: string, reason: string) {
  const supabase = await createClient();
  await supabase.from('rooms').update({ paused_until: untilISO, pause_reason: reason || null }).eq('id', roomId);
  revalidatePath(`/c/${containerId}`);
}

export async function resumeRoom(containerId: string, roomId: string) {
  const supabase = await createClient();
  await supabase.from('rooms').update({ paused_until: null, pause_reason: null }).eq('id', roomId);
  revalidatePath(`/c/${containerId}`);
}

export async function pauseContainer(containerId: string, untilISO: string, reason: string) {
  const supabase = await createClient();
  await supabase.from('containers').update({ paused_until: untilISO, pause_reason: reason || null }).eq('id', containerId);
  revalidatePath(`/c/${containerId}`);
}

export async function resumeContainer(containerId: string) {
  const supabase = await createClient();
  await supabase.from('containers').update({ paused_until: null, pause_reason: null }).eq('id', containerId);
  revalidatePath(`/c/${containerId}`);
}

export async function updateContainer(containerId: string, formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const icon = String(formData.get('icon') ?? '🏠');
  const color = String(formData.get('color') ?? '#14b8a6');
  if (!name) return { error: 'Le nom est requis.' };

  const supabase = await createClient();
  const { error } = await supabase.from('containers').update({ name, icon, color }).eq('id', containerId);
  if (error) return { error: 'Impossible de modifier le conteneur (droits insuffisants ?).' };
  // Le nom/icône/couleur du conteneur sont affichés dans le layout partagé par toutes ses pages :
  // revalider tout le layout authentifié évite les mêmes soucis de cache que pour les tâches.
  revalidatePath('/', 'layout');
  return {};
}
