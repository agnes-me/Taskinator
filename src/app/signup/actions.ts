'use server';

import { createClient } from '@/lib/supabase/server';

export async function signup(_prevState: { error: string | null; done?: boolean }, formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  const name = String(formData.get('name') ?? '').trim();

  if (!email || !password || password.length < 8) {
    return { error: 'E-mail requis et mot de passe d’au moins 8 caractères.' };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: name || null } },
  });

  if (error) {
    return { error: error.message === 'User already registered' ? 'Ce compte existe déjà.' : 'Impossible de créer le compte.' };
  }

  return { error: null, done: true };
}
