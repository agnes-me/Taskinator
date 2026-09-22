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
