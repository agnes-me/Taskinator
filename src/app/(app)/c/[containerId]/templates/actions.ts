'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Priority, RecurrenceType, TemplateVisibility } from '@/types/database';

// Les policies de sécurité (RLS) de room_templates se référencent elles-mêmes pour la
// visibilité (personnel/conteneur/public) : PostgreSQL exige alors que la ligne insérée soit
// déjà visible au moment même de l'insertion pour pouvoir la renvoyer (`.select().single()`),
// ce qu'un `INSERT ... RETURNING` ne garantit pas toujours pour ce genre de policy
// auto-référentielle. On contourne en générant l'UUID côté client : plus besoin de RETURNING.

export interface TemplateItemInput {
  title: string;
  recurrence_type: RecurrenceType;
  recurrence_interval: number;
  priority: Priority;
  freshness_days: number | null;
}

export async function createRoomTemplate(
  containerId: string,
  data: { name: string; icon: string; visibility: TemplateVisibility; items: TemplateItemInput[] },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié.' };
  if (!data.name.trim()) return { error: 'Le nom est requis.' };

  const templateId = randomUUID();
  const { error } = await supabase.from('room_templates').insert({
    id: templateId,
    name: data.name.trim(),
    icon: data.icon,
    visibility: data.visibility,
    owner_container_id: data.visibility === 'container' ? containerId : null,
    created_by: user.id,
  });

  if (error) return { error: 'Impossible de créer le template.' };

  if (data.items.length) {
    const { error: itemsError } = await supabase.from('room_template_items').insert(
      data.items.map((item, i) => ({ ...item, template_id: templateId, sort_order: i })),
    );
    if (itemsError) return { error: "Le template a été créé mais l'ajout des tâches a échoué." };
  }

  revalidatePath(`/c/${containerId}/templates`);
  return {};
}

export async function createRoomFromTemplate(containerId: string, templateId: string, roomName: string, roomIcon: string) {
  const supabase = await createClient();
  if (!roomName.trim()) return { error: 'Le nom de la pièce est requis.' };

  const { data: room, error: roomError } = await supabase
    .from('rooms')
    .insert({ container_id: containerId, name: roomName.trim(), icon: roomIcon })
    .select('id')
    .single();

  if (roomError || !room) return { error: 'Impossible de créer la pièce.' };

  const { error: applyError } = await supabase.rpc('apply_room_template', { p_template_id: templateId, p_room_id: room.id });
  if (applyError) return { error: "La pièce a été créée mais l'application du template a échoué." };

  revalidatePath(`/c/${containerId}`);
  revalidatePath(`/c/${containerId}/tasks`);
  return { roomId: room.id };
}

export async function getRoomTemplateItems(templateId: string): Promise<{ error: string } | { items: TemplateItemInput[] }> {
  const supabase = await createClient();
  const { data: items, error } = await supabase
    .from('room_template_items')
    .select('title, recurrence_type, recurrence_interval, priority, freshness_days')
    .eq('template_id', templateId)
    .order('sort_order');
  if (error) return { error: 'Impossible de charger le template.' };
  return { items: items ?? [] };
}

export async function updateRoomTemplate(
  containerId: string,
  templateId: string,
  data: { name: string; icon: string; items: TemplateItemInput[] },
) {
  if (!data.name.trim()) return { error: 'Le nom est requis.' };

  const supabase = await createClient();
  const { error } = await supabase.from('room_templates').update({ name: data.name.trim(), icon: data.icon }).eq('id', templateId);
  if (error) return { error: 'Impossible de modifier le template (droits insuffisants ?).' };

  await supabase.from('room_template_items').delete().eq('template_id', templateId);
  if (data.items.length) {
    const { error: itemsError } = await supabase.from('room_template_items').insert(
      data.items.map((item, i) => ({ ...item, template_id: templateId, sort_order: i })),
    );
    if (itemsError) return { error: "Le template a été renommé mais la mise à jour des tâches a échoué." };
  }

  revalidatePath(`/c/${containerId}/templates`);
  return {};
}

export async function deleteRoomTemplate(containerId: string, templateId: string) {
  const supabase = await createClient();
  await supabase.from('room_templates').delete().eq('id', templateId);
  revalidatePath(`/c/${containerId}/templates`);
}

export async function duplicateRoomTemplate(containerId: string, templateId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié.' };

  const { data: source } = await supabase.from('room_templates').select('name, icon').eq('id', templateId).maybeSingle();
  const { data: items } = await supabase
    .from('room_template_items')
    .select('title, description, recurrence_type, recurrence_interval, recurrence_weekdays, priority, freshness_days, sort_order')
    .eq('template_id', templateId);

  if (!source) return { error: 'Template introuvable.' };

  const copyId = randomUUID();
  const { error } = await supabase
    .from('room_templates')
    .insert({ id: copyId, name: `${source.name} (copie)`, icon: source.icon, visibility: 'personal', created_by: user.id });
  if (error) return { error: 'Impossible de dupliquer.' };

  if (items?.length) {
    await supabase.from('room_template_items').insert(items.map((item) => ({ ...item, template_id: copyId })));
  }

  revalidatePath(`/c/${containerId}/templates`);
  return {};
}

export async function publishRoomTemplate(containerId: string, templateId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('room_templates')
    .update({ visibility: 'public', moderation_status: 'pending' })
    .eq('id', templateId);
  if (error) return { error: 'Impossible de publier (droits insuffisants ?).' };
  revalidatePath(`/c/${containerId}/templates`);
  return {};
}

export async function applyRoomTemplateToRoom(containerId: string, templateId: string, roomId: string) {
  const supabase = await createClient();
  const { error } = await supabase.rpc('apply_room_template', { p_template_id: templateId, p_room_id: roomId });
  if (error) return { error: "Impossible d'appliquer le template." };
  revalidatePath(`/c/${containerId}`);
  revalidatePath(`/c/${containerId}/tasks`);
  revalidatePath(`/c/${containerId}/rooms/${roomId}`);
  return {};
}
