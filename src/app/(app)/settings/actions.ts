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
