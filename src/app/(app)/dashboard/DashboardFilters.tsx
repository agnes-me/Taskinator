'use client';

import { useRouter, useSearchParams } from 'next/navigation';

export function DashboardFilters({
  containers,
  rooms,
}: {
  containers: { id: string; name: string }[];
  rooms: { id: string; name: string; container_id: string }[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const container = searchParams.get('container') ?? '';
  const room = searchParams.get('room') ?? '';
  const priority = searchParams.get('priority') ?? '';
  const dueBefore = searchParams.get('dueBefore') ?? '';
  const hasFilters = Boolean(container || room || priority || dueBefore);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    if (key === 'container') params.delete('room');
    router.push(`/dashboard${params.toString() ? `?${params.toString()}` : ''}`);
  }

  const filteredRooms = container ? rooms.filter((r) => r.container_id === container) : rooms;

  return (
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-xs text-[var(--text-muted)]">
        Conteneur
        <select className="input mt-1" value={container} onChange={(e) => setParam('container', e.target.value)}>
          <option value="">Tous</option>
          {containers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-[var(--text-muted)]">
        Catégorie
        <select className="input mt-1" value={room} onChange={(e) => setParam('room', e.target.value)}>
          <option value="">Toutes</option>
          {filteredRooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-xs text-[var(--text-muted)]">
        Échéance avant le
        <input type="date" className="input mt-1" value={dueBefore} onChange={(e) => setParam('dueBefore', e.target.value)} />
      </label>
      <label className="text-xs text-[var(--text-muted)]">
        Difficulté
        <select className="input mt-1" value={priority} onChange={(e) => setParam('priority', e.target.value)}>
          <option value="">Toutes</option>
          <option value="low">Basse</option>
          <option value="medium">Moyenne</option>
          <option value="high">Haute</option>
        </select>
      </label>
      {hasFilters && (
        <button className="btn btn-ghost text-xs" onClick={() => router.push('/dashboard')}>
          Réinitialiser
        </button>
      )}
    </div>
  );
}
