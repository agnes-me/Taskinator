'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [mode, setMode] = useState<'create' | 'join'>('create');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [householdName, setHouseholdName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password, mode, householdName, inviteCode }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? 'Une erreur est survenue.');
      setLoading(false);
      return;
    }

    const signInRes = await signIn('credentials', { email, password, redirect: false });
    setLoading(false);
    if (signInRes?.error) {
      setError('Compte créé, mais la connexion a échoué. Réessayez de vous connecter.');
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="text-3xl">🧩</div>
          <h1 className="mt-2 text-xl font-bold">Créer votre espace</h1>
          <p className="text-sm text-slate-500">Un foyer = une équipe qui partage ses listes de tâches.</p>
        </div>

        <div className="mb-4 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
          <button
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${mode === 'create' ? 'bg-white shadow dark:bg-slate-900' : 'text-slate-500'}`}
            onClick={() => setMode('create')}
            type="button"
          >
            Créer un foyer
          </button>
          <button
            className={`flex-1 rounded-lg py-2 text-sm font-medium ${mode === 'join' ? 'bg-white shadow dark:bg-slate-900' : 'text-slate-500'}`}
            onClick={() => setMode('join')}
            type="button"
          >
            Rejoindre un foyer
          </button>
        </div>

        <form onSubmit={handleSubmit} className="card space-y-4">
          <div>
            <label className="label">Votre nom</label>
            <input className="input" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="label">Mot de passe (8 caractères min.)</label>
            <input
              className="input"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {mode === 'create' ? (
            <div>
              <label className="label">Nom du foyer</label>
              <input
                className="input"
                required
                placeholder="Ex: Maison Martin"
                value={householdName}
                onChange={(e) => setHouseholdName(e.target.value)}
              />
            </div>
          ) : (
            <div>
              <label className="label">Code d&apos;invitation</label>
              <input
                className="input uppercase"
                required
                placeholder="Ex: AB12CD"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
              />
            </div>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button className="btn-primary w-full" type="submit" disabled={loading}>
            {loading ? 'Création...' : 'Créer mon compte'}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-slate-500">
          Déjà un compte ?{' '}
          <Link href="/login" className="font-medium text-brand-700 dark:text-brand-400">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  );
}
