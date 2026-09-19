import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { listPendingModeration } from '@/lib/data/templates';
import { ModerationClient } from './ModerationClient';

export default async function ModerationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) redirect('/dashboard');

  const { roomTemplates, eventTemplates } = await listPendingModeration(supabase);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">🛡️ Modération de la marketplace</h1>
      <p className="mb-4 text-sm text-[var(--text-muted)]">
        Aucun envoi d'e-mail automatique n'est configuré (nécessiterait une clé API d'un service mail) — pensez à consulter cette page
        après une publication.
      </p>
      <ModerationClient roomTemplates={roomTemplates} eventTemplates={eventTemplates} />
    </div>
  );
}
