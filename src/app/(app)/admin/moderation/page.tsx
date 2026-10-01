import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/supabase/user';
import { listPendingModeration, listApprovedMarketplace } from '@/lib/data/templates';
import { ModerationClient } from './ModerationClient';

export default async function ModerationPage() {
  const user = await getAuthUser();
  if (!user || user.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) redirect('/dashboard');

  const supabase = await createClient();

  const [pending, published] = await Promise.all([listPendingModeration(supabase), listApprovedMarketplace(supabase)]);

  return (
    <div>
      <h1 className="mb-4 text-xl font-bold">🛡️ Modération de la marketplace</h1>
      <p className="mb-4 text-sm text-[var(--text-muted)]">
        Aucun envoi d'e-mail automatique n'est configuré (nécessiterait une clé API d'un service mail) — pensez à consulter cette page
        après une publication.
      </p>
      <ModerationClient
        pendingRoomTemplates={pending.roomTemplates}
        pendingEventTemplates={pending.eventTemplates}
        publishedRoomTemplates={published.roomTemplates}
        publishedEventTemplates={published.eventTemplates}
      />
    </div>
  );
}
