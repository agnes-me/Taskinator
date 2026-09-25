import type { SupabaseServerClient } from '@/lib/supabase/server';
import type { Database, ModerationStatus, TemplateVisibility } from '@/types/database';

export interface TemplateSummary {
  id: string;
  name: string;
  icon: string;
  is_system: boolean;
  visibility: TemplateVisibility;
  moderation_status: ModerationStatus;
  created_by: string | null;
  owner_container_id: string | null;
  itemCount: number;
}

async function withItemCounts<T extends { id: string }>(
  supabase: SupabaseServerClient,
  table: 'room_template_items' | 'event_template_items',
  fkColumn: 'template_id' | 'event_template_id',
  templates: T[],
): Promise<(T & { itemCount: number })[]> {
  if (templates.length === 0) return [];
  const { data: items } = await supabase
    .from(table)
    .select(fkColumn)
    .in(fkColumn, templates.map((t) => t.id));
  return templates.map((t) => ({
    ...t,
    itemCount: (items ?? []).filter((i) => (i as Record<string, string>)[fkColumn] === t.id).length,
  }));
}

export async function listRoomTemplates(supabase: SupabaseServerClient, containerId: string) {
  const { data } = await supabase
    .from('room_templates')
    .select('id, name, icon, is_system, visibility, moderation_status, created_by, owner_container_id')
    .or(`is_system.eq.true,owner_container_id.eq.${containerId},visibility.eq.public`)
    .order('is_system', { ascending: false });

  return withItemCounts(supabase, 'room_template_items', 'template_id', data ?? []);
}

export async function listEventTemplates(supabase: SupabaseServerClient, containerId: string) {
  const { data } = await supabase
    .from('event_templates')
    .select('id, name, icon, is_system, visibility, moderation_status, created_by, owner_container_id')
    .or(`is_system.eq.true,owner_container_id.eq.${containerId},visibility.eq.public`)
    .order('is_system', { ascending: false });

  return withItemCounts(supabase, 'event_template_items', 'event_template_id', data ?? []);
}

export async function listPendingModeration(supabase: SupabaseServerClient) {
  const [{ data: roomTemplates }, { data: eventTemplates }] = await Promise.all([
    supabase.from('room_templates').select('id, name, icon, created_by').eq('moderation_status', 'pending'),
    supabase.from('event_templates').select('id, name, icon, created_by').eq('moderation_status', 'pending'),
  ]);
  return { roomTemplates: roomTemplates ?? [], eventTemplates: eventTemplates ?? [] };
}

/** Templates déjà publiés sur la marketplace (approuvés) — pour que la modération puisse aussi les retirer. */
export async function listApprovedMarketplace(supabase: SupabaseServerClient) {
  const [{ data: roomTemplates }, { data: eventTemplates }] = await Promise.all([
    supabase.from('room_templates').select('id, name, icon, created_by').eq('visibility', 'public').eq('moderation_status', 'approved'),
    supabase.from('event_templates').select('id, name, icon, created_by').eq('visibility', 'public').eq('moderation_status', 'approved'),
  ]);
  return { roomTemplates: roomTemplates ?? [], eventTemplates: eventTemplates ?? [] };
}
