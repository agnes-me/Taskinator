'use client';

import Link from 'next/link';
import { useTransition } from 'react';
import { completeTask } from '@/app/(app)/c/[containerId]/tasks/actions';
import { PRIORITY_LABELS } from '@/lib/recurrence';
import { formatDate } from '@/lib/utils';
import type { MyTask } from '@/lib/data/dashboard';

export function DashboardTaskItem({ task }: { task: MyTask }) {
  const [pending, startTransition] = useTransition();

  return (
    <li className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-[var(--surface-muted)]">
      <button
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            await completeTask(task.id, task.container_id, new FormData());
          })
        }
        className="btn btn-ghost !px-2 !py-1 text-xs disabled:opacity-40"
        title="Marquer comme faite"
      >
        ⬜️
      </button>
      <Link href={`/c/${task.container_id}/tasks`} className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <span className="truncate">{task.title}</span>
        <span className="shrink-0 text-xs text-[var(--text-muted)]">
          {task.container_name}
          {task.room_name ? ` · ${task.room_name}` : ''} · {PRIORITY_LABELS[task.priority]} {task.due_date ? `· ${formatDate(task.due_date)}` : ''}
        </span>
      </Link>
    </li>
  );
}
