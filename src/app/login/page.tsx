'use client';

import { Suspense, useActionState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { login } from './actions';

function LoginForm() {
  const params = useSearchParams();
  const [state, formAction, pending] = useActionState<{ error: string | null }, FormData>(login, { error: null });

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={params.get('next') ?? '/dashboard'} />
      <label className="text-sm font-medium">
        E-mail
        <input name="email" type="email" required autoComplete="email" className="input mt-1 w-full" />
      </label>
      <label className="text-sm font-medium">
        Mot de passe
        <input name="password" type="password" required autoComplete="current-password" className="input mt-1 w-full" />
      </label>
      {state.error && <p className="text-sm text-fresh-low">{state.error}</p>}
      <button type="submit" disabled={pending} className="btn btn-primary mt-2 w-full disabled:opacity-60">
        {pending ? 'Connexion…' : 'Se connecter'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <div className="text-3xl">✅</div>
          <h1 className="mt-2 text-xl font-bold">Taskinator</h1>
          <p className="text-sm text-[var(--text-muted)]">Connectez-vous à votre foyer</p>
        </div>
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
        <p className="mt-4 text-center text-sm text-[var(--text-muted)]">
          Pas encore de compte ?{' '}
          <Link href="/signup" className="font-semibold text-container">
            Créer un compte
          </Link>
        </p>
      </div>
    </div>
  );
}
