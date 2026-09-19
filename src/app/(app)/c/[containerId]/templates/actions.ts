'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Priority, RecurrenceType, TemplateVisibility } from '@/types/database';

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

  const { data: tpl, error } = await supabase
    .from('room_templates')
    .insert({
      name: data.name.trim(),
      icon: data.icon,
      visibility: data.visibility,
      owner_container_id: data.visibility === 'container' ? containerId : null,
      created_by: user.id,
    })
    .select('id')
    .single();

  if (error || !tpl) return { error: 'Impossible de créer le template.' };

  if (data.items.length) {
    await supabase.from('room_template_items').insert(
      data.items.map((item, i) => ({ ...item, template_id: tpl.id, sort_order: i })),
    );
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

  const { data: copy, error } = await supabase
    .from('room_templates')
    .insert({ name: `${source.name} (copie)`, icon: source.icon, visibility: 'personal', created_by: user.id })
    .select('id')
    .single();
  if (error || !copy) return { error: 'Impossible de dupliquer.' };

  if (items?.length) {
    await supabase.from('room_template_items').insert(items.map((item) => ({ ...item, template_id: copy.id })));
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
