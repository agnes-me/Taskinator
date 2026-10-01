'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

function revalidateNotes(containerId: string) {
  revalidatePath(`/c/${containerId}/notes`);
}

export async function createNote(containerId: string, title: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié.' };

  const { data, error } = await supabase
    .from('container_notes')
    .insert({ container_id: containerId, title: title.trim() || 'Sans titre', created_by: user.id, updated_by: user.id })
    .select('id')
    .single();
  if (error || !data) return { error: 'Impossible de créer la note.' };

  revalidateNotes(containerId);
  return { noteId: data.id };
}

export async function updateNote(containerId: string, noteId: string, title: string, content: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Non authentifié.' };

  const { error } = await supabase
    .from('container_notes')
    .update({ title: title.trim() || 'Sans titre', content, updated_by: user.id, updated_at: new Date().toISOString() })
    .eq('id', noteId);
  if (error) return { error: 'Impossible d\'enregistrer la note (droits insuffisants ?).' };

  revalidateNotes(containerId);
  return {};
}

export async function deleteNote(containerId: string, noteId: string) {
  const supabase = await createClient();
  const { data: images } = await supabase.from('container_note_images').select('storage_path').eq('note_id', noteId);
  if (images && images.length > 0) {
    await supabase.storage.from('note-images').remove(images.map((i) => i.storage_path));
  }
  await supabase.from('container_notes').delete().eq('id', noteId);
  revalidateNotes(containerId);
}

export async function uploadNoteImage(containerId: string, noteId: string, formData: FormData) {
  const file = formData.get('image') as File | null;
  if (!file || file.size === 0) return { error: 'Aucune image sélectionnée.' };

  const supabase = await createClient();
  const path = `${containerId}/${noteId}/${Date.now()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from('note-images').upload(path, file, { contentType: file.type });
  if (uploadError) return { error: "Impossible d'envoyer l'image (droits insuffisants ?)." };

  const { error } = await supabase.from('container_note_images').insert({ note_id: noteId, storage_path: path });
  if (error) return { error: "Image envoyée mais impossible de l'attacher à la note." };

  revalidateNotes(containerId);
  return {};
}

export async function deleteNoteImage(containerId: string, imageId: string) {
  const supabase = await createClient();
  const { data: image } = await supabase.from('container_note_images').select('storage_path').eq('id', imageId).maybeSingle();
  if (image) await supabase.storage.from('note-images').remove([image.storage_path]);
  await supabase.from('container_note_images').delete().eq('id', imageId);
  revalidateNotes(containerId);
}

/** Génère le contenu Markdown de toutes les notes du conteneur, images incluses (liens signés
 * valables 7 jours — suffisant pour un export ponctuel, mais ils finiront par expirer). */
export async function exportNotesMarkdown(containerId: string): Promise<{ error: string } | { markdown: string }> {
  const supabase = await createClient();
  const { data: notes } = await supabase
    .from('container_notes')
    .select('id, title, content, updated_at')
    .eq('container_id', containerId)
    .order('title');
  if (!notes || notes.length === 0) return { markdown: '' };

  const noteIds = notes.map((n) => n.id);
  const { data: images } = await supabase.from('container_note_images').select('note_id, storage_path').in('note_id', noteIds);

  const signedByPath = new Map<string, string>();
  if (images && images.length > 0) {
    const { data: signed } = await supabase.storage
      .from('note-images')
      .createSignedUrls(
        images.map((img) => img.storage_path),
        60 * 60 * 24 * 7,
      );
    signed?.forEach((s, i) => {
      if (s.signedUrl) signedByPath.set(images[i].storage_path, s.signedUrl);
    });
  }

  const sections = notes.map((n) => {
    const noteImages = (images ?? []).filter((img) => img.note_id === n.id);
    const imageLines = noteImages.map((img) => `![](${signedByPath.get(img.storage_path) ?? ''})`).join('\n');
    return `# ${n.title}\n\n${n.content}${imageLines ? `\n\n${imageLines}` : ''}`;
  });

  return { markdown: sections.join('\n\n---\n\n') };
}
