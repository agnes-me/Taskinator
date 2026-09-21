'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

export async function updateThemeGradient(colors: string[]) {
  const cleaned = colors.map((c) => c.trim());

  if (cleaned.length < 2 || cleaned.length > 5) {
    return { error: 'Choisis entre 2 et 5 couleurs.' };
  }
  if (!cleaned.every((c) => HEX_RE.test(c))) {
    return { error: 'Couleur invalide.' };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié.' };

  const { error } = await supabase.from('profiles').update({ theme_gradient: cleaned }).eq('id', user.id);
  if (error) return { error: 'Impossible d’enregistrer le dégradé.' };

  revalidatePath('/', 'layout');
  return {};
}

const ICS_URL_RE = /^https:\/\/.+\.ics(\?.*)?$/i;

export async function addIcalSubscription(label: string, url: string) {
  const cleanedLabel = label.trim() || 'Calendrier';
  const cleanedUrl = url.trim();
  if (!ICS_URL_RE.test(cleanedUrl)) {
    return {
      error:
        "Cette adresse ne ressemble pas à un fichier iCal (elle doit se terminer par .ics). Sur Google Calendar : " +
        "Réglages du calendrier concerné → « Intégrer l'agenda » → « Adresse secrète au format iCal » — pas le lien " +
        "« Obtenir le lien pour le partage », qui ne fonctionne pas ici.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié.' };

  const { error } = await supabase.from('ical_subscriptions').insert({ user_id: user.id, label: cleanedLabel, url: cleanedUrl });
  if (error) return { error: `Impossible d'enregistrer ce calendrier — ${error.message} (${error.code}).` };

  revalidatePath('/', 'layout');
  return {};
}

export async function deleteIcalSubscription(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from('ical_subscriptions').delete().eq('id', id);
  if (error) return { error: `Impossible de supprimer ce calendrier — ${error.message} (${error.code}).` };

  revalidatePath('/', 'layout');
  return {};
}

export async function updateDisplayName(name: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié.' };

  const { error } = await supabase.from('profiles').update({ display_name: name.trim() || null }).eq('id', user.id);
  if (error) return { error: 'Impossible d’enregistrer le nom.' };

  revalidatePath('/', 'layout');
  return {};
}
