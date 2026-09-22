'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function addChecklistItem(taskId: string, containerId: string, formData: FormData) {
  const label = String(formData.get('label') ?? '').trim();
  const groupName = String(formData.get('groupName') ?? '').trim() || null;
  if (!label) return { error: "Le nom de l'article est requis." };

  const supabase = await createClient();
  const { error } = await supabase.from('checklist_items').insert({ task_id: taskId, group_name: groupName, label });
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
    .select('group_name, label, sort_order')
    .eq('template_id', templateId)
    .order('sort_order');
  if (!items || items.length === 0) return { error: 'Ce template est vide.' };

  const { error } = await supabase
    .from('checklist_items')
    .insert(items.map((i) => ({ task_id: taskId, group_name: i.group_name, label: i.label, sort_order: i.sort_order })));
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
    .select('group_name, label, sort_order')
    .eq('task_id', taskId)
    .order('sort_order');

  const { data: template, error } = await supabase
    .from('checklist_templates')
    .insert({ container_id: containerId, name: trimmed, created_by: user.id })
    .select('id')
    .single();
  if (error || !template) return { error: 'Impossible de créer le template.' };

  if (items && items.length > 0) {
    await supabase
      .from('checklist_template_items')
      .insert(items.map((i) => ({ template_id: template.id, group_name: i.group_name, label: i.label, sort_order: i.sort_order })));
  }
  revalidatePath('/', 'layout');
  return {};
}

export async function deleteChecklistTemplate(containerId: string, templateId: string) {
  const supabase = await createClient();
  await supabase.from('checklist_templates').delete().eq('id', templateId);
  revalidatePath('/', 'layout');
}
