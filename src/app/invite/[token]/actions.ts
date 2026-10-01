'use server';

import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function acceptInvite(token: string) {
  const supabase = await createClient();
  const { data: containerId, error } = await supabase.rpc('accept_container_invitation', { p_token: token });

  if (error || !containerId) {
    return { error: error?.message ?? "Cette invitation n'est plus valable." };
  }

  redirect(`/c/${containerId}`);
}
