'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function createInvitation(containerId: string, role: 'admin' | 'member' | 'guest', email: string | null) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié.' };

  const { data, error } = await supabase
    .from('container_invitations')
    .insert({ container_id: containerId, role, email: email || null, created_by: user.id })
    .select('token')
    .single();

  if (error || !data) return { error: "Impossible de créer l'invitation." };
  revalidatePath(`/c/${containerId}/members`);
  return { token: data.token };
}

export async function revokeInvitation(containerId: string, invitationId: string) {
  const supabase = await createClient();
  await supabase.from('container_invitations').delete().eq('id', invitationId);
  revalidatePath(`/c/${containerId}/members`);
}

export async function updateMemberRole(containerId: string, memberId: string, role: 'admin' | 'member' | 'guest') {
  const supabase = await createClient();
  const { error } = await supabase.from('container_members').update({ role }).eq('id', memberId);
  if (error) return { error: 'Impossible de changer le rôle.' };
  revalidatePath(`/c/${containerId}/members`);
  return {};
}

export async function removeMember(containerId: string, memberId: string) {
  const supabase = await createClient();
  await supabase.from('container_members').delete().eq('id', memberId);
  revalidatePath(`/c/${containerId}/members`);
}
