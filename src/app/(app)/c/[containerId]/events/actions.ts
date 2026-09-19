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

export async function applyEventTemplate(containerId: string, templateId: string, name: string, eventDate: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('apply_event_template', {
    p_template_id: templateId,
    p_container_id: containerId,
    p_name: name,
    p_event_date: eventDate,
  });
  if (error || !data) return { error: "Impossible d'appliquer le template." };
  revalidatePath(`/c/${containerId}/events`);
  revalidatePath(`/c/${containerId}/tasks`);
  return { eventId: data };
}
