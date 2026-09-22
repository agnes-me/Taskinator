import type { SupabaseServerClient } from '@/lib/supabase/server';

export interface ChecklistItem {
  id: string;
  task_id: string;
  parent_item_id: string | null;
  label: string;
  checked: boolean;
  sort_order: number;
}

export interface ChecklistTemplate {
  id: string;
  name: string;
  icon: string;
  itemCount: number;
}

export interface ChecklistTemplateItem {
  id: string;
  parent_item_id: string | null;
  label: string;
  sort_order: number;
}

/** Templates de liste (courses, cadeaux...) disponibles dans un conteneur, pour le sélecteur "Appliquer un template". */
export async function getChecklistTemplates(supabase: SupabaseServerClient, containerId: string): Promise<ChecklistTemplate[]> {
  const { data: templates } = await supabase.from('checklist_templates').select('id, name, icon').eq('container_id', containerId).order('name');
  if (!templates || templates.length === 0) return [];

  const ids = templates.map((t) => t.id);
  const { data: items } = await supabase.from('checklist_template_items').select('template_id').in('template_id', ids);
  return templates.map((t) => ({ ...t, itemCount: (items ?? []).filter((i) => i.template_id === t.id).length }));
}

export async function getChecklistTemplateItems(supabase: SupabaseServerClient, templateId: string): Promise<ChecklistTemplateItem[]> {
  const { data } = await supabase
    .from('checklist_template_items')
    .select('id, parent_item_id, label, sort_order')
    .eq('template_id', templateId)
    .order('sort_order');
  return data ?? [];
}
