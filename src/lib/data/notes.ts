import type { SupabaseServerClient } from '@/lib/supabase/server';

export interface NoteImage {
  id: string;
  url: string;
}

export interface ContainerNote {
  id: string;
  title: string;
  content: string;
  updated_at: string;
  updated_by_name: string | null;
  images: NoteImage[];
}

export async function listContainerNotes(supabase: SupabaseServerClient, containerId: string): Promise<ContainerNote[]> {
  const { data: notes } = await supabase
    .from('container_notes')
    .select('id, title, content, updated_at, updated_by')
    .eq('container_id', containerId)
    .order('updated_at', { ascending: false });

  if (!notes || notes.length === 0) return [];

  const noteIds = notes.map((n) => n.id);
  const updaterIds = [...new Set(notes.map((n) => n.updated_by).filter((id): id is string => Boolean(id)))];

  const [{ data: images }, { data: profiles }] = await Promise.all([
    supabase.from('container_note_images').select('id, note_id, storage_path').in('note_id', noteIds).order('created_at'),
    updaterIds.length
      ? supabase.from('profiles').select('id, email, display_name').in('id', updaterIds)
      : Promise.resolve({ data: [] as { id: string; email: string; display_name: string | null }[] }),
  ]);

  // Signe les chemins de stockage une seule fois ici (le bucket est privé) plutôt que de laisser
  // chaque composant client refaire l'appel — les URLs signées sont valables 1h, largement
  // suffisant pour une session de consultation des notes.
  const signedByPath = new Map<string, string>();
  if (images && images.length > 0) {
    const { data: signed } = await supabase.storage
      .from('note-images')
      .createSignedUrls(
        images.map((img) => img.storage_path),
        3600,
      );
    signed?.forEach((s, i) => {
      if (s.signedUrl) signedByPath.set(images[i].storage_path, s.signedUrl);
    });
  }

  return notes.map((n) => {
    const profile = profiles?.find((p) => p.id === n.updated_by);
    const noteImages = (images ?? [])
      .filter((img) => img.note_id === n.id)
      .map((img) => ({ id: img.id, url: signedByPath.get(img.storage_path) ?? '' }))
      .filter((img) => img.url);
    return {
      id: n.id,
      title: n.title,
      content: n.content,
      updated_at: n.updated_at,
      updated_by_name: profile?.display_name ?? profile?.email ?? null,
      images: noteImages,
    };
  });
}
