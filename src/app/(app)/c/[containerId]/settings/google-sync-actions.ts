'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getValidAccessToken } from '@/lib/google-oauth';
import { listWritableCalendars } from '@/lib/google-calendar-api';

export async function listMyGoogleCalendarsForSync(): Promise<{ error: string } | { calendars: { id: string; summary: string }[] }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié.' };

  const token = await getValidAccessToken(supabase, user.id);
  if (!token) return { error: 'Connecte Google Calendar dans Réglages avant de configurer la synchro.' };

  try {
    const calendars = await listWritableCalendars(token);
    return { calendars: calendars.map((c) => ({ id: c.id, summary: c.summary })) };
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Impossible de lister tes agendas Google.' };
  }
}

export async function setContainerGoogleSync(containerId: string, googleCalendarId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié.' };

  const { error } = await supabase
    .from('container_google_sync')
    .upsert({ container_id: containerId, synced_by: user.id, google_calendar_id: googleCalendarId, enabled: true, updated_at: new Date().toISOString() });
  if (error) return { error: `Impossible d'activer la synchro — ${error.message}` };

  revalidatePath(`/c/${containerId}/settings`);
  return {};
}

export async function setContainerGoogleSyncEnabled(containerId: string, enabled: boolean) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('container_google_sync')
    .update({ enabled, updated_at: new Date().toISOString() })
    .eq('container_id', containerId);
  if (error) return { error: `Impossible de modifier la synchro — ${error.message}` };

  revalidatePath(`/c/${containerId}/settings`);
  return {};
}

export async function removeContainerGoogleSync(containerId: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('container_google_sync').delete().eq('container_id', containerId);
  if (error) return { error: `Impossible de retirer la synchro — ${error.message}` };

  revalidatePath(`/c/${containerId}/settings`);
  return {};
}
