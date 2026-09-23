'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { Priority, RecurrenceType, TemplateVisibility } from '@/types/database';

export interface EventTemplateItemInput {
  title: string;
  offset_days: number;
  priority: Priority;
  recurrence_type: RecurrenceType;
}

export async function createEventTemplate(
  containerId: string,
  data: { name: string; icon: string; visibility: TemplateVisibility; items: EventTemplateItemInput[] },
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié.' };
  if (!data.name.trim()) return { error: 'Le nom est requis.' };

  const templateId = randomUUID();
  const { error } = await supabase.from('event_templates').insert({
    id: templateId,
    name: data.name.trim(),
    icon: data.icon,
    visibility: data.visibility,
    owner_container_id: data.visibility === 'container' ? containerId : null,
    created_by: user.id,
  });

  if (error) return { error: 'Impossible de créer le template.' };

  if (data.items.length) {
    const { error: itemsError } = await supabase.from('event_template_items').insert(
      data.items.map((item, i) => ({ ...item, event_template_id: templateId, sort_order: i })),
    );
    if (itemsError) return { error: "Le template a été créé mais l'ajout des étapes a échoué." };
  }

  revalidatePath(`/c/${containerId}/events`);
  return {};
}

export async function getEventTemplateItems(templateId: string): Promise<{ error: string } | { items: EventTemplateItemInput[] }> {
  const supabase = await createClient();
  const { data: items, error } = await supabase
    .from('event_template_items')
    .select('title, offset_days, priority, recurrence_type')
    .eq('event_template_id', templateId)
    .order('sort_order');
  if (error) return { error: 'Impossible de charger le template.' };
  return { items: items ?? [] };
}

export async function updateEventTemplate(
  containerId: string,
  templateId: string,
  data: { name: string; icon: string; items: EventTemplateItemInput[] },
) {
  if (!data.name.trim()) return { error: 'Le nom est requis.' };

  const supabase = await createClient();
  const { error } = await supabase.from('event_templates').update({ name: data.name.trim(), icon: data.icon }).eq('id', templateId);
  if (error) return { error: 'Impossible de modifier le template (droits insuffisants ?).' };

  await supabase.from('event_template_items').delete().eq('event_template_id', templateId);
  if (data.items.length) {
    const { error: itemsError } = await supabase.from('event_template_items').insert(
      data.items.map((item, i) => ({ ...item, event_template_id: templateId, sort_order: i })),
    );
    if (itemsError) return { error: "Le template a été renommé mais la mise à jour des étapes a échoué." };
  }

  revalidatePath(`/c/${containerId}/events`);
  return {};
}

export async function deleteEventTemplate(containerId: string, templateId: string) {
  const supabase = await createClient();
  await supabase.from('event_templates').delete().eq('id', templateId);
  revalidatePath(`/c/${containerId}/events`);
}

export async function publishEventTemplate(containerId: string, templateId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('event_templates')
    .update({ visibility: 'public', moderation_status: 'pending' })
    .eq('id', templateId);
  if (error) return { error: 'Impossible de publier (droits insuffisants ?).' };
  revalidatePath(`/c/${containerId}/events`);
  return {};
}

/** Crée un événement vide (sans rétroplanning) : on y ajoute ensuite des tâches au cas par cas. */
export async function createEvent(containerId: string, name: string, eventDate: string, recurrenceType: 'none' | 'yearly' = 'none') {
  if (!name.trim()) return { error: 'Le nom est requis.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié.' };

  const { data, error } = await supabase
    .from('events')
    .insert({ container_id: containerId, name: name.trim(), event_date: eventDate, recurrence_type: recurrenceType, created_by: user.id })
    .select('id')
    .single();
  if (error || !data) return { error: "Impossible de créer l'événement." };

  revalidatePath(`/c/${containerId}/events`);
  return { eventId: data.id };
}

export async function applyEventTemplate(
  containerId: string,
  templateId: string,
  name: string,
  eventDate: string,
  recurrenceType: 'none' | 'yearly' = 'none',
) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('apply_event_template', {
    p_template_id: templateId,
    p_container_id: containerId,
    p_name: name,
    p_event_date: eventDate,
  });
  if (error || !data) return { error: "Impossible d'appliquer le template." };
  if (recurrenceType !== 'none') await supabase.from('events').update({ recurrence_type: recurrenceType }).eq('id', data);
  revalidatePath(`/c/${containerId}/events`);
  revalidatePath(`/c/${containerId}/tasks`);
  return { eventId: data };
}

export async function updateEvent(
  containerId: string,
  eventId: string,
  data: { name: string; event_date: string; recurrence_type: 'none' | 'yearly' },
) {
  if (!data.name.trim()) return { error: 'Le nom est requis.' };

  const supabase = await createClient();
  const { error } = await supabase
    .from('events')
    .update({ name: data.name.trim(), event_date: data.event_date, recurrence_type: data.recurrence_type })
    .eq('id', eventId);
  if (error) return { error: "Impossible de modifier l'événement (droits insuffisants ?)." };

  revalidatePath(`/c/${containerId}/events`);
  revalidatePath(`/c/${containerId}/calendar`);
  return {};
}

export async function deleteEvent(containerId: string, eventId: string) {
  const supabase = await createClient();
  await supabase.from('events').delete().eq('id', eventId);
  revalidatePath(`/c/${containerId}/events`);
  revalidatePath(`/c/${containerId}/calendar`);
}
