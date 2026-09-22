'use client';

import { useState } from 'react';
import type { TemplateSummary } from '@/lib/data/templates';
import { TemplatesClient } from '../templates/TemplatesClient';
import { EventTemplatesClient } from '../events/EventTemplatesClient';
import { MembersClient } from '../members/MembersClient';
import { GoogleSyncForm, type ContainerGoogleSync } from './GoogleSyncForm';

type Tab = 'rooms' | 'events' | 'members' | 'google';
type Member = { id: string; user_id: string; role: 'admin' | 'member' | 'guest'; email: string; display_name: string | null };
type Invitation = { id: string; token: string; role: string; email: string | null; expires_at: string };

export function SettingsClient({
  containerId,
  initialTab,
  roomTemplates,
  eventTemplates,
  rooms,
  canManage,
  currentUserId,
  members,
  invitations,
  isAdmin,
  googleConnected,
  googleSync,
}: {
  containerId: string;
  initialTab: Tab;
  roomTemplates: { system: TemplateSummary[]; container: TemplateSummary[]; personal: TemplateSummary[]; marketplace: TemplateSummary[] };
  eventTemplates: TemplateSummary[];
  rooms: { id: string; name: string }[];
  canManage: boolean;
  currentUserId: string;
  members: Member[];
  invitations: Invitation[];
  isAdmin: boolean;
  googleConnected: boolean;
  googleSync: ContainerGoogleSync | null;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'rooms', label: '🏠 Templates de catégories' },
    { key: 'events', label: '🎉 Templates d\'événements' },
    { key: 'members', label: '👥 Membres' },
    { key: 'google', label: '🔄 Google Calendar' },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl font-bold">⚙️ Paramètres du conteneur</h1>
        <p className="text-sm text-[var(--text-muted)]">Gestion des templates et des accès — regroupés ici pour ne pas encombrer le menu principal.</p>
      </div>

      <nav className="flex gap-1 overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium ${
              tab === t.key ? 'bg-[var(--surface-muted)]' : 'hover:bg-[var(--surface-muted)]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'rooms' && (
        <TemplatesClient
          containerId={containerId}
          system={roomTemplates.system}
          container={roomTemplates.container}
          personal={roomTemplates.personal}
          marketplace={roomTemplates.marketplace}
          rooms={rooms}
          canManage={canManage}
          currentUserId={currentUserId}
        />
      )}
      {tab === 'events' && (
        <EventTemplatesClient containerId={containerId} templates={eventTemplates} canManage={canManage} currentUserId={currentUserId} />
      )}
      {tab === 'members' && (
        <MembersClient containerId={containerId} members={members} invitations={invitations} currentUserId={currentUserId} isAdmin={isAdmin} />
      )}
      {tab === 'google' && <GoogleSyncForm containerId={containerId} googleConnected={googleConnected} sync={googleSync} />}
    </div>
  );
}
