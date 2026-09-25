'use client';

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { completeTask, reopenTask } from '@/app/(app)/c/[containerId]/tasks/actions';
import { FreshnessBar } from '@/components/FreshnessBar';
import { PRIORITY_LABELS } from '@/lib/recurrence';
import { formatDate } from '@/lib/utils';
import type { MyTask } from '@/lib/data/dashboard';

const PRIORITY_DOT: Record<string, string> = { low: 'bg-slate-400', medium: 'bg-amber-500', high: 'bg-rose-500' };

export function DashboardTaskItem({ task, depth = 0 }: { task: MyTask; depth?: number }) {
  const [expanded, setExpanded] = useState(false);
  const [pending, startTransition] = useTransition();
  const doneSubtasks = task.subtasks.filter((s) => s.status === 'done').length;
  const showFreshness = task.freshness !== null && (task.recurrence_type !== 'none' || task.subtasks.length > 0);

  function quickToggle() {
    if (task.status === 'done') {
      startTransition(() => reopenTask(task.id, task.container_id));
    } else {
      startTransition(async () => {
        await completeTask(task.id, task.container_id, new FormData());
      });
    }
  }

  return (
    <li className="flex flex-col gap-1" style={{ marginLeft: depth * 16 }}>
      <div className="flex items-center gap-2 rounded-lg p-2 text-sm hover:bg-[var(--surface-muted)]">
        <button
          disabled={pending}
          onClick={quickToggle}
          className="btn btn-ghost !px-2 !py-1 text-xs disabled:opacity-40"
          title={task.status === 'done' ? 'Décocher (annuler)' : 'Marquer comme faite'}
        >
          {task.status === 'done' ? '✅' : '⬜️'}
        </button>
        <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} title={PRIORITY_LABELS[task.priority]} />

        <Link href={`/c/${task.container_id}/tasks`} className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <span className={`truncate ${task.status === 'done' ? 'line-through opacity-60' : ''}`}>{task.title}</span>
          <span className="shrink-0 text-xs text-[var(--text-muted)]">
            {task.container_name}
            {task.room_name ? ` · ${task.room_name}` : ''} · {PRIORITY_LABELS[task.priority]} {task.due_date ? `· ${formatDate(task.due_date)}` : ''}
          </span>
        </Link>

        {showFreshness && task.freshness && (
          <span className="w-10 shrink-0" title={`Fraîcheur ${task.freshness.percent}%`}>
            <FreshnessBar freshness={task.freshness} compact />
          </span>
        )}

        {task.subtasks.length > 0 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="btn btn-ghost !px-2 !py-1 text-xs"
            aria-label={expanded ? 'Replier les sous-tâches' : 'Déplier les sous-tâches'}
          >
            {expanded ? '▾' : '▸'} {doneSubtasks}/{task.subtasks.length}
          </button>
        )}
      </div>

      {expanded && task.subtasks.length > 0 && (
        <ul className="flex flex-col gap-1">
          {task.subtasks.map((sub) => (
            <DashboardTaskItem key={sub.id} task={sub} depth={depth + 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
