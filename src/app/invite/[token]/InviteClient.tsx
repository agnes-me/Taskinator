'use client';

import { useState, useTransition } from 'react';
import { acceptInvite } from './actions';

export function InviteClient({ token }: { token: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div>
      <button
        className="btn btn-primary w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await acceptInvite(token);
            if (res?.error) setError(res.error);
          })
        }
      >
        {pending ? 'Un instant…' : "Rejoindre le conteneur"}
      </button>
      {error && <p className="mt-3 text-sm text-fresh-low">{error}</p>}
    </div>
  );
}
