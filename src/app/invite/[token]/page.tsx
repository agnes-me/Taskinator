import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { InviteClient } from './InviteClient';

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-8 text-center">
        <div className="text-3xl">✉️</div>
        <h1 className="mt-2 text-xl font-bold">Invitation Taskinator</h1>
        {user ? (
          <>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Connecté·e en tant que {user.email}.</p>
            <div className="mt-4">
              <InviteClient token={token} />
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-[var(--text-muted)]">Connectez-vous ou créez un compte pour accepter cette invitation.</p>
            <div className="mt-4 flex gap-2">
              <Link href={`/login?next=/invite/${token}`} className="btn btn-primary flex-1">
                Se connecter
              </Link>
              <Link href="/signup" className="btn btn-ghost flex-1">
                Créer un compte
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
