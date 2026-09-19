'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { signup } from './actions';

export default function SignupPage() {
  const [state, formAction, pending] = useActionState<{ error: string | null; done?: boolean }, FormData>(signup, { error: null });

  if (state.done) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="card w-full max-w-sm p-8 text-center">
          <div className="text-3xl">📬</div>
          <h1 className="mt-2 text-xl font-bold">Vérifiez vos e-mails</h1>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            Un lien de confirmation vous a été envoyé. Cliquez dessus pour activer votre compte, puis connectez-vous.
          </p>
          <Link href="/login" className="btn btn-primary mt-4 inline-block">
            Aller à la connexion
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 text-center">
          <div className="text-3xl">🧺</div>
          <h1 className="mt-2 text-xl font-bold">Créer un compte</h1>
        </div>
        <form action={formAction} className="flex flex-col gap-3">
          <label className="text-sm font-medium">
            Prénom
            <input name="name" type="text" autoComplete="name" className="input mt-1 w-full" />
          </label>
          <label className="text-sm font-medium">
            E-mail
            <input name="email" type="email" required autoComplete="email" className="input mt-1 w-full" />
          </label>
          <label className="text-sm font-medium">
            Mot de passe
            <input name="password" type="password" required minLength={8} autoComplete="new-password" className="input mt-1 w-full" />
          </label>
          {state.error && <p className="text-sm text-fresh-low">{state.error}</p>}
          <button type="submit" disabled={pending} className="btn btn-primary mt-2 w-full disabled:opacity-60">
            {pending ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-[var(--text-muted)]">
          Déjà un compte ?{' '}
          <Link href="/login" className="font-semibold text-container">
            Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
