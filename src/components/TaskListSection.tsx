'use client';

import { useState } from 'react';
import type { TaskRow as TaskRowType } from '@/lib/data/tasks';
import { TaskRow } from './TaskRow';
import { TaskForm, type ContainerMember } from './TaskForm';
import { STATUS_LABELS } from '@/lib/recurrence';
import type { ChecklistTemplate } from '@/lib/data/checklist';

const PRIORITY_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 };

function byUrgency(a: TaskRowType, b: TaskRowType): number {
  const pr = PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];
  if (pr !== 0) return pr;
  if (a.due_date && b.due_date) return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0;
  if (a.due_date) return -1;
  if (b.due_date) return 1;
  return 0;
}

export function TaskListSection({
  containerId,
  tasks,
  members,
  rooms,
  currentUserId,
  isGuest,
  canEdit,
  fixedRoomId,
  checklistTemplates = [],
}: {
  containerId: string;
  tasks: TaskRowType[];
  members: ContainerMember[];
  rooms: { id: string; name: string }[];
  currentUserId: string;
  isGuest: boolean;
  canEdit: boolean;
  fixedRoomId?: string;
  checklistTemplates?: ChecklistTemplate[];
}) {
  const [showForm, setShowForm] = useState(false);
  const groups: { key: string; label: string }[] = [
    { key: 'todo', label: STATUS_LABELS.todo },
    { key: 'in_progress', label: STATUS_LABELS.in_progress },
    { key: 'done', label: STATUS_LABELS.done },
  ];

  return (
    <div className="flex flex-col gap-4">
      {canEdit && (
        <div>
          {!showForm ? (
            <button className="btn btn-primary" onClick={() => setShowForm(true)}>
              + Nouvelle tâche
            </button>
          ) : (
            <div className="card p-4">
              <TaskForm
                containerId={containerId}
                members={members}
                rooms={rooms}
                fixedRoomId={fixedRoomId}
                onDone={() => setShowForm(false)}
                onCancel={() => setShowForm(false)}
              />
            </div>
          )}
        </div>
      )}

      {tasks.length === 0 ? (
        <p className="card p-6 text-center text-sm text-[var(--text-muted)]">Aucune tâche ici pour l'instant.</p>
      ) : (
        groups.map((g) => {
          const groupTasks = tasks.filter((t) => t.status === g.key).sort(byUrgency);
          if (groupTasks.length === 0) return null;
          return (
            <div key={g.key}>
              <h3 className="mb-2 text-sm font-semibold text-[var(--text-muted)]">
                {g.label} ({groupTasks.length})
              </h3>
              <div className="flex flex-col gap-2">
                {groupTasks.map((task) => (
                  <TaskRow
                    key={task.id}
                    task={task}
                    containerId={containerId}
                    members={members}
                    rooms={rooms}
                    currentUserId={currentUserId}
                    isGuest={isGuest}
                    canEdit={canEdit}
                    checklistTemplates={checklistTemplates}
                  />
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
