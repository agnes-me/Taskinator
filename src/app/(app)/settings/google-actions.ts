'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { disconnectGoogleAccount, getValidAccessToken } from '@/lib/google-oauth';
import { listWritableCalendars } from '@/lib/google-calendar-api';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export async function disconnectGoogle() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié.' };

  await disconnectGoogleAccount(supabase, user.id);
  revalidatePath('/settings');
  revalidatePath('/', 'layout');
  return {};
}

/** Agendas Google accessibles en écriture mais pas encore ajoutés à Taskinator — pour le sélecteur "+ ajouter". */
export async function listAddableGoogleCalendars(): Promise<{ error: string } | { calendars: { id: string; summary: string }[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié.' };

  const token = await getValidAccessToken(supabase, user.id);
  if (!token) return { error: 'Reconnexion Google nécessaire.' };

  const { data: already } = await supabase.from('google_calendars').select('google_calendar_id').eq('user_id', user.id);
  const alreadyIds = new Set((already ?? []).map((c) => c.google_calendar_id));

  try {
    const all = await listWritableCalendars(token);
    return { calendars: all.filter((c) => !alreadyIds.has(c.id)).map((c) => ({ id: c.id, summary: c.summary })) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Impossible de lister tes agendas Google.' };
  }
}

export async function addGoogleCalendar(googleCalendarId: string, label: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié.' };

  const { error } = await supabase.from('google_calendars').insert({ user_id: user.id, google_calendar_id: googleCalendarId, label });
  if (error) return { error: `Impossible d'ajouter cet agenda — ${error.message}` };

  revalidatePath('/', 'layout');
  return {};
}

export async function removeGoogleCalendar(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('google_calendars').delete().eq('id', id);
  if (error) return { error: `Impossible de retirer cet agenda — ${error.message}` };

  revalidatePath('/', 'layout');
  return {};
}

export async function updateGoogleCalendar(id: string, patch: { color?: string; visible?: boolean }) {
  if (patch.color !== undefined && !HEX_RE.test(patch.color)) {
    return { error: 'Couleur invalide.' };
  }
  const supabase = await createClient();
  const { error } = await supabase.from('google_calendars').update(patch).eq('id', id);
  if (error) return { error: `Impossible de modifier cet agenda — ${error.message}` };

  revalidatePath('/', 'layout');
  return {};
}

export interface ManageableContainer {
  id: string;
  name: string;
  icon: string;
  householdName: string;
  syncedCalendarId: string | null;
  syncEnabled: boolean;
}

/** Conteneurs où l'utilisateur est admin/membre (donc autorisé à configurer la synchro), avec leur état actuel. */
export async function listMyManageableContainers(): Promise<{ error: string } | { containers: ManageableContainer[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié.' };

  const { data: memberships } = await supabase
    .from('container_members')
    .select('container_id, role')
    .eq('user_id', user.id)
    .in('role', ['admin', 'member']);
  const containerIds = (memberships ?? []).map((m) => m.container_id);
  if (containerIds.length === 0) return { containers: [] };

  const [{ data: containers }, { data: syncRows }] = await Promise.all([
    supabase.from('containers').select('id, name, icon, household_id').in('id', containerIds),
    supabase.from('container_google_sync').select('container_id, google_calendar_id, enabled').in('container_id', containerIds),
  ]);

  const householdIds = [...new Set((containers ?? []).map((c) => c.household_id))];
  const { data: households } = householdIds.length
    ? await supabase.from('households').select('id, name').in('id', householdIds)
    : { data: [] };

  const syncByContainer = new Map((syncRows ?? []).map((s) => [s.container_id, s]));
  const householdNameById = new Map((households ?? []).map((h) => [h.id, h.name]));

  return {
    containers: (containers ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      icon: c.icon,
      householdName: householdNameById.get(c.household_id) ?? '',
      syncedCalendarId: syncByContainer.get(c.id)?.google_calendar_id ?? null,
      syncEnabled: syncByContainer.get(c.id)?.enabled ?? false,
    })),
  };
}

/** Applique le même agenda cible à plusieurs conteneurs d'un coup — même effet que répéter l'action par conteneur. */
export async function applyGoogleSyncToContainers(containerIds: string[], googleCalendarId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié.' };
  if (containerIds.length === 0) return { error: 'Sélectionne au moins un conteneur.' };

  const rows = containerIds.map((containerId) => ({
    container_id: containerId,
    synced_by: user.id,
    google_calendar_id: googleCalendarId,
    enabled: true,
    updated_at: new Date().toISOString(),
  }));

  const { error } = await supabase.from('container_google_sync').upsert(rows);
  if (error) return { error: `Impossible d'appliquer la synchro — ${error.message}` };

  revalidatePath('/settings');
  containerIds.forEach((id) => revalidatePath(`/c/${id}/settings`));
  return {};
}
