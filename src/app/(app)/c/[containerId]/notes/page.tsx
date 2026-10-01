import { createClient } from '@/lib/supabase/server';
import { getContainerContext } from '@/lib/data/nav';
import { getContainerNotes } from '@/lib/data/notes';
import { NotesClient } from './NotesClient';

export default async function NotesPage({ params }: { params: Promise<{ containerId: string }> }) {
  const { containerId } = await params;
  const supabase = await createClient();

  const [{ role }, notes] = await Promise.all([getContainerContext(containerId), getContainerNotes(supabase, containerId)]);

  const canEdit = role === 'admin' || role === 'member';

  return <NotesClient containerId={containerId} notes={notes} canEdit={canEdit} />;
}
