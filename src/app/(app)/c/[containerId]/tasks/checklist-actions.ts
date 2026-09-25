'use server';

import { randomUUID } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getChecklistTemplateItems } from '@/lib/data/checklist';

export async function addChecklistItem(taskId: string, containerId: string, formData: FormData) {
  const label = String(formData.get('label') ?? '').trim();
  const parentItemId = String(formData.get('parentItemId') ?? '').trim() || null;
  if (!label) return { error: "Le nom de l'article est requis." };

  const supabase = await createClient();
  const { error } = await supabase.from('checklist_items').insert({ task_id: taskId, parent_item_id: parentItemId, label });
  if (error) return { error: "Impossible d'ajouter l'article (droits insuffisants ?)." };
  revalidatePath('/', 'layout');
  return {};
}

export async function toggleChecklistItem(itemId: string, containerId: string, checked: boolean) {
  const supabase = await createClient();
  await supabase.from('checklist_items').update({ checked }).eq('id', itemId);
  revalidatePath('/', 'layout');
}

export async function deleteChecklistItem(itemId: string, containerId: string) {
  const supabase = await createClient();
  await supabase.from('checklist_items').delete().eq('id', itemId);
  revalidatePath('/', 'layout');
}

export async function applyChecklistTemplate(taskId: string, containerId: string, templateId: string) {
  const supabase = await createClient();
  const { data: items } = await supabase
    .from('checklist_template_items')
    .select('id, parent_item_id, label, sort_order')
    .eq('template_id', templateId)
    .order('sort_order');
  if (!items || items.length === 0) return { error: 'Ce template est vide.' };

  // Remappe les ids du template vers de nouveaux ids d'articles, pour reconstituer la même
  // hiérarchie sur la tâche cible en un seul insert (pas de RPC nécessaire ici).
  const idMap = new Map<string, string>();
  for (const item of items) idMap.set(item.id, randomUUID());

  const rows = items.map((item) => ({
    id: idMap.get(item.id),
    task_id: taskId,
    parent_item_id: item.parent_item_id ? (idMap.get(item.parent_item_id) ?? null) : null,
    label: item.label,
    sort_order: item.sort_order,
  }));

  const { error } = await supabase.from('checklist_items').insert(rows);
  if (error) return { error: "Impossible d'appliquer le template." };
  revalidatePath('/', 'layout');
  return {};
}

export async function saveChecklistAsTemplate(containerId: string, taskId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) return { error: 'Le nom du template est requis.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié.' };

  const { data: items } = await supabase
    .from('checklist_items')
    .select('id, parent_item_id, label, sort_order')
    .eq('task_id', taskId)
    .order('sort_order');

  const { data: template, error } = await supabase
    .from('checklist_templates')
    .insert({ container_id: containerId, name: trimmed, created_by: user.id })
    .select('id')
    .single();
  if (error || !template) return { error: 'Impossible de créer le template.' };

  if (items && items.length > 0) {
    const idMap = new Map<string, string>();
    for (const item of items) idMap.set(item.id, randomUUID());
    const rows = items.map((item) => ({
      id: idMap.get(item.id),
      template_id: template.id,
      parent_item_id: item.parent_item_id ? (idMap.get(item.parent_item_id) ?? null) : null,
      label: item.label,
      sort_order: item.sort_order,
    }));
    await supabase.from('checklist_template_items').insert(rows);
  }
  revalidatePath('/', 'layout');
  return {};
}

export interface ChecklistTemplateItemDraft {
  id: string;
  parentId: string | null;
  label: string;
}

/** Crée un template de liste de zéro, depuis la page dédiée (Réglages -> Templates de listes). */
export async function createChecklistTemplate(containerId: string, name: string, icon: string, items: ChecklistTemplateItemDraft[]) {
  const trimmed = name.trim();
  if (!trimmed) return { error: 'Le nom est requis.' };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié.' };

  const { data: template, error } = await supabase
    .from('checklist_templates')
    .insert({ container_id: containerId, name: trimmed, icon, created_by: user.id })
    .select('id')
    .single();
  if (error || !template) return { error: 'Impossible de créer le template.' };

  const cleanItems = items.filter((it) => it.label.trim());
  if (cleanItems.length > 0) {
    const { error: itemsError } = await supabase.from('checklist_template_items').insert(
      cleanItems.map((it, i) => ({
        id: it.id,
        template_id: template.id,
        parent_item_id: it.parentId,
        label: it.label.trim(),
        sort_order: i,
      })),
    );
    if (itemsError) return { error: "Le template a été créé mais l'ajout des articles a échoué." };
  }

  revalidatePath(`/c/${containerId}/settings`);
  return {};
}

export async function updateChecklistTemplate(
  containerId: string,
  templateId: string,
  name: string,
  icon: string,
  items: ChecklistTemplateItemDraft[],
) {
  const trimmed = name.trim();
  if (!trimmed) return { error: 'Le nom est requis.' };

  const supabase = await createClient();
  const { error } = await supabase.from('checklist_templates').update({ name: trimmed, icon }).eq('id', templateId);
  if (error) return { error: 'Impossible de modifier le template (droits insuffisants ?).' };

  await supabase.from('checklist_template_items').delete().eq('template_id', templateId);
  const cleanItems = items.filter((it) => it.label.trim());
  if (cleanItems.length > 0) {
    const { error: itemsError } = await supabase.from('checklist_template_items').insert(
      cleanItems.map((it, i) => ({
        id: it.id,
        template_id: templateId,
        parent_item_id: it.parentId,
        label: it.label.trim(),
        sort_order: i,
      })),
    );
    if (itemsError) return { error: "Le template a été renommé mais la mise à jour des articles a échoué." };
  }

  revalidatePath(`/c/${containerId}/settings`);
  return {};
}

export async function getChecklistTemplateItemsForEdit(
  templateId: string,
): Promise<{ error: string } | { items: { id: string; parent_item_id: string | null; label: string; sort_order: number }[] }> {
  const supabase = await createClient();
  const items = await getChecklistTemplateItems(supabase, templateId);
  return { items };
}

export async function deleteChecklistTemplate(containerId: string, templateId: string) {
  const supabase = await createClient();
  await supabase.from('checklist_templates').delete().eq('id', templateId);
  revalidatePath(`/c/${containerId}/settings`);
  revalidatePath('/', 'layout');
}
