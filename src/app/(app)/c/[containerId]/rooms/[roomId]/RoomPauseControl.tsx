'use client';

import { useTransition } from 'react';
import { pauseRoom, resumeRoom } from '../../actions';

export function RoomPauseControl({ containerId, roomId, pausedUntil }: { containerId: string; roomId: string; pausedUntil: string | null }) {
  const [pending, startTransition] = useTransition();
  const isPaused = pausedUntil && new Date(pausedUntil) > new Date();

  return (
    <button
      disabled={pending}
      className="btn btn-ghost text-sm"
      onClick={() => {
        if (isPaused) {
          startTransition(() => resumeRoom(containerId, roomId));
        } else {
          const days = window.prompt('Mettre cette catégorie en pause pendant combien de jours ?', '14');
          if (!days) return;
          const until = new Date(Date.now() + Number(days) * 86_400_000).toISOString();
          startTransition(() => pauseRoom(containerId, roomId, until, ''));
        }
      }}
    >
      {isPaused ? '▶️ Reprendre' : '⏸ Pause'}
    </button>
  );
}
