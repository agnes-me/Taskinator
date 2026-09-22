'use server';

import { revalidatePath } from 'next/cache';
import { createClient, type SupabaseServerClient } from '@/lib/supabase/server';
import { getValidAccessToken } from '@/lib/google-oauth';
import { createEvent, updateEvent, deleteEvent } from '@/lib/google-calendar-api';

async function getTokenOrError(supabase: SupabaseServerClient) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié.' } as const;
  const token = await getValidAccessToken(supabase, user.id);
  if (!token) return { error: 'Connexion Google expirée — reconnecte-toi dans Réglages.' } as const;
  return { token } as const;
}

/** Événement ponctuel créé directement depuis Taskinator, indépendant de toute tâche — pour un ajout exceptionnel sur un agenda choisi. */
export async function createGoogleEventManual(
  googleCalendarId: string,
  data: { summary: string; startISO: string; endISO: string; allDay: boolean },
) {
  const supabase = await createClient();
  const auth = await getTokenOrError(supabase);
  if ('error' in auth) return auth;

  try {
    await createEvent(auth.token, googleCalendarId, data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Impossible de créer l'événement." };
  }
  revalidatePath('/', 'layout');
  return {};
}

export async function updateGoogleEvent(
  googleCalendarId: string,
  googleEventId: string,
  data: { summary: string; startISO: string; endISO: string; allDay: boolean },
) {
  const supabase = await createClient();
  const auth = await getTokenOrError(supabase);
  if ('error' in auth) return auth;

  try {
    await updateEvent(auth.token, googleCalendarId, googleEventId, data);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Impossible de modifier cet événement.' };
  }
  revalidatePath('/', 'layout');
  return {};
}

export async function deleteGoogleEvent(googleCalendarId: string, googleEventId: string) {
  const supabase = await createClient();
  const auth = await getTokenOrError(supabase);
  if ('error' in auth) return auth;

  try {
    await deleteEvent(auth.token, googleCalendarId, googleEventId);
  } catch (e) {
    return { error: e instanceof Error ? e.message : 'Impossible de supprimer cet événement.' };
  }
  revalidatePath('/', 'layout');
  return {};
}
