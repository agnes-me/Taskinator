'use client';

import { useState, useTransition } from 'react';
import { ROLE_LABELS } from '@/lib/recurrence';
import { createInvitation, revokeInvitation, removeMember, updateMemberRole } from './actions';

type Member = { id: string; user_id: string; role: 'admin' | 'member' | 'guest'; email: string; display_name: string | null };
type Invitation = { id: string; token: string; role: string; email: string | null; expires_at: string };

export function MembersClient({
  containerId,
  members,
  invitations,
  currentUserId,
  isAdmin,
}: {
  containerId: string;
  members: Member[];
  invitations: Invitation[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [role, setRole] = useState<'admin' | 'member' | 'guest'>('member');
  const [email, setEmail] = useState('');
  const [newLink, setNewLink] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const origin = typeof window !== 'undefined' ? window.location.origin : '';

  function handleInvite() {
    startTransition(async () => {
      const res = await createInvitation(containerId, role, email || null);
      if ('token' in res) {
        setNewLink(`${origin}/invite/${res.token}`);
        setEmail('');
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="card p-4">
        <h2 className="mb-3 font-semibold">Membres</h2>
        <ul className="flex flex-col gap-2">
          {members.map((m) => (
            <li key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border)] p-2">
              <div>
                <p className="text-sm font-medium">{m.display_name || m.email}</p>
                <p className="text-xs text-[var(--text-muted)]">{m.email}</p>
              </div>
              {isAdmin && m.user_id !== currentUserId ? (
                <div className="flex items-center gap-2">
                  <select
                    defaultValue={m.role}
                    className="input !py-1 text-sm"
                    onChange={(e) => startTransition(() => void updateMemberRole(containerId, m.id, e.target.value as 'admin' | 'member' | 'guest'))}
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Membre</option>
                    <option value="guest">Invité·e</option>
                  </select>
                  <button
                    className="btn btn-ghost !px-2 !py-1 text-xs text-fresh-low"
                    onClick={() => startTransition(() => removeMember(containerId, m.id))}
                  >
                    Retirer
                  </button>
                </div>
              ) : (
                <span className="chip bg-[var(--surface-muted)]">{ROLE_LABELS[m.role]}</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {isAdmin && (
        <div className="card p-4">
          <h2 className="mb-3 font-semibold">Inviter quelqu'un</h2>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-sm">
              E-mail (optionnel)
              <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ami@exemple.com" className="input mt-1" />
            </label>
            <label className="text-sm">
              Rôle
              <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'member' | 'guest')} className="input mt-1">
                <option value="admin">Admin</option>
                <option value="member">Membre</option>
                <option value="guest">Invité·e</option>
              </select>
            </label>
            <button onClick={handleInvite} disabled={pending} className="btn btn-primary">
              Générer un lien d'invitation
            </button>
          </div>
          {newLink && (
            <p className="mt-3 break-all rounded-lg bg-[var(--surface-muted)] p-2 text-sm">
              Lien (valable 14 jours) : <code>{newLink}</code>
            </p>
          )}

          {invitations.length > 0 && (
            <ul className="mt-4 flex flex-col gap-2">
              {invitations.map((inv) => (
                <li key={inv.id} className="flex items-center justify-between gap-2 rounded-lg border border-[var(--border)] p-2 text-sm">
                  <span>
                    {inv.email || 'Lien ouvert'} · {ROLE_LABELS[inv.role]} · expire le {new Date(inv.expires_at).toLocaleDateString('fr-FR')}
                  </span>
                  <button
                    className="btn btn-ghost !px-2 !py-1 text-xs text-fresh-low"
                    onClick={() => startTransition(() => revokeInvitation(containerId, inv.id))}
                  >
                    Révoquer
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
