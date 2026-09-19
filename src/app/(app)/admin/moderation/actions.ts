'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

export async function moderateTemplate(kind: 'room' | 'event', templateId: string, decision: 'approved' | 'rejected') {
  const supabase = await createClient();
  const table = kind === 'room' ? 'room_templates' : 'event_templates';
  const { error } = await supabase.from(table).update({ moderation_status: decision }).eq('id', templateId);
  if (error) return { error: "Action refusée (réservée à l'administratrice)." };
  revalidatePath('/admin/moderation');
  return {};
}
