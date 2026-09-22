'use client';

import { useState, useTransition } from 'react';
import type { TaskRow as TaskRowType } from '@/lib/data/tasks';
import { FreshnessBar } from '@/components/FreshnessBar';
import { recurrenceLabel, PRIORITY_LABELS } from '@/lib/recurrence';
import { formatDate, todayISO } from '@/lib/utils';
import { completeTask, reopenTask, deleteTask, pauseTask, resumeTask, createTask } from '@/app/(app)/c/[containerId]/tasks/actions';
import { TaskForm, type ContainerMember } from './TaskForm';
import { ChecklistSection } from './ChecklistSection';
import type { ChecklistTemplate } from '@/lib/data/checklist';

const PRIORITY_COLOR: Record<string, string> = { low: 'bg-slate-400/20 text-slate-500', medium: 'bg-amber-400/20 text-amber-600', high: 'bg-rose-400/20 text-rose-600' };
const PRIORITY_DOT: Record<string, string> = { low: 'bg-slate-400', medium: 'bg-amber-500', high: 'bg-rose-500' };

export function TaskRow({
  task,
  containerId,
  members,
  rooms,
  currentUserId,
  isGuest,
  canEdit,
  checklistTemplates = [],
  depth = 0,
}: {
  task: TaskRowType;
  containerId: string;
  members: ContainerMember[];
  rooms: { id: string; name: string }[];
  currentUserId: string;
  isGuest: boolean;
  canEdit: boolean;
  checklistTemplates?: ChecklistTemplate[];
  depth?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingSub, setAddingSub] = useState(false);
  const [subtaskError, setSubtaskError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  const isAssignee = task.assignees.some((a) => a.user_id === currentUserId);
  const canComplete = canEdit || (isGuest && isAssignee);
  const isPaused = task.paused_until && new Date(task.paused_until) > new Date();
  const doneSubtasks = task.subtasks.filter((s) => s.status === 'done').length;
  // Une tâche ponctuelle sans sous-tâche a une fraîcheur binaire (faite/à faire) uniquement pour
  // compter dans l'agrégat de sa pièce — inutile de l'afficher en plus de la case à cocher, déjà
  // parlante pour ce cas-là.
  const showFreshness = task.freshness !== null && (task.recurrence_type !== 'none' || task.subtasks.length > 0);

  function quickComplete() {
    startTransition(async () => {
      await completeTask(task.id, containerId, new FormData());
    });
  }

  function quickToggle() {
    if (task.status === 'done') {
      startTransition(() => reopenTask(task.id, containerId));
    } else {
      quickComplete();
    }
  }

  if (editing) {
    return (
      <div className="card p-4" style={{ marginLeft: depth * 20 }}>
        <TaskForm
          containerId={containerId}
          members={members}
          rooms={rooms}
          task={task}
          fixedRoomId={undefined}
          onDone={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <div className="card flex flex-col gap-2 px-3 py-2" style={{ marginLeft: depth * 20 }}>
      {/* Ligne compacte : toujours visible, pour voir beaucoup de tâches d'un coup. */}
      <div className="flex items-center gap-2">
        <button
          disabled={!canComplete || pending}
          onClick={quickToggle}
          className="btn btn-ghost !px-2 !py-1 text-xs disabled:opacity-40"
          title={task.status === 'done' ? 'Décocher (annuler)' : 'Marquer comme faite'}
        >
          {task.status === 'done' ? '✅' : '⬜️'}
        </button>

        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex min-w-0 flex-1 items-center gap-2 py-1 text-left"
          aria-expanded={expanded}
        >
          <span className={`h-2 w-2 shrink-0 rounded-full ${PRIORITY_DOT[task.priority]}`} title={PRIORITY_LABELS[task.priority]} />
          <span className={`truncate ${task.status === 'done' ? 'line-through opacity-60' : 'font-medium'}`}>{task.title}</span>
          {isPaused && <span className="shrink-0 text-xs">⏸</span>}
          {task.subtasks.length > 0 && (
            <span className="shrink-0 text-xs text-[var(--text-muted)]">
              {doneSubtasks}/{task.subtasks.length}
            </span>
          )}
        </button>

        <div className="flex shrink-0 items-center gap-2 text-xs text-[var(--text-muted)]">
          {task.room && (
            <span className="flex items-center gap-1" title={task.room.name}>
              <span>{task.room.icon}</span>
              <span className="hidden max-w-[90px] truncate sm:inline">{task.room.name}</span>
            </span>
          )}
          {!task.room && task.event && (
            <span className="flex items-center gap-1" title={task.event.name}>
              <span>🎉</span>
              <span className="hidden max-w-[90px] truncate sm:inline">{task.event.name}</span>
            </span>
          )}
          {task.due_date && <span className="hidden sm:inline">{formatDate(task.due_date)}</span>}
          {showFreshness && task.freshness && (
            <span
              className="w-10 shrink-0"
              title={
                (task.freshness.frozen
                  ? 'En pause'
                  : task.freshness.outOfSeason
                    ? 'Hors saison'
                    : `Fraîcheur ${task.freshness.percent}%`) +
                (task.recurrence_type === 'none' && task.subtasks.length > 0 ? ' (moyenne des sous-tâches)' : '')
              }
            >
              <FreshnessBar freshness={task.freshness} compact />
            </span>
          )}
          {task.assignees.length > 0 && (
            <span className="hidden items-center gap-1 sm:flex" title={task.assignees.map((a) => a.display_name || a.email).join(', ')}>
              {task.assignees.slice(0, 3).map((a) => (
                <span
                  key={a.user_id}
                  className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--surface-muted)] text-[10px] font-semibold"
                >
                  {(a.display_name || a.email).slice(0, 1).toUpperCase()}
                </span>
              ))}
            </span>
          )}
        </div>

        <button
          onClick={() => setExpanded((e) => !e)}
          className="btn btn-ghost !px-2 !py-1 text-xs"
          aria-label={expanded ? 'Replier' : 'Déplier pour voir et modifier'}
        >
          {expanded ? '▾' : '▸'}
        </button>
      </div>

      {/* Détails complets : uniquement une fois dépliée. */}
      {expanded && (
        <div className="flex flex-col gap-2 border-t border-[var(--border)] pt-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`chip ${PRIORITY_COLOR[task.priority]}`}>{PRIORITY_LABELS[task.priority]}</span>
                {isPaused && <span className="chip bg-fresh-mid/20 text-fresh-mid">⏸ pause</span>}
                {task.on_calendar && <span className="chip bg-brand-500/10 text-brand-600">📅</span>}
              </div>
              {task.description && <p className="mt-1 text-sm text-[var(--text-muted)]">{task.description}</p>}
              <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
                <span>{recurrenceLabel(task.recurrence_type, task.recurrence_interval, task.recurrence_weekdays)}</span>
                {task.due_date && <span>· Échéance {formatDate(task.due_date)}</span>}
                {task.room && (
                  <span>
                    · {task.room.icon} {task.room.name}
                  </span>
                )}
                {task.event && <span>· 🎉 {task.event.name}</span>}
                {task.assignees.length > 0 && <span>· 👤 {task.assignees.map((a) => a.display_name || a.email).join(', ')}</span>}
              </div>
              {showFreshness && task.freshness && (
                <div className="mt-2 max-w-xs">
                  <FreshnessBar freshness={task.freshness} compact />
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center gap-1">
              {canComplete && task.status !== 'done' && !completing && (
                <button
                  className="btn btn-ghost !px-2 !py-1 text-xs"
                  onClick={() => setCompleting(true)}
                  title="Terminer avec une photo ou un commentaire"
                >
                  📷
                </button>
              )}
              {canEdit && (
                <>
                  <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => setEditing(true)}>
                    ✏️
                  </button>
                  <button
                    className="btn btn-ghost !px-2 !py-1 text-xs"
                    onClick={() => {
                      if (isPaused) startTransition(() => resumeTask(task.id, containerId));
                      else {
                        const days = window.prompt('Mettre en pause pendant combien de jours ?', '14');
                        if (!days) return;
                        const until = new Date(Date.now() + Number(days) * 86_400_000).toISOString();
                        startTransition(() => pauseTask(task.id, containerId, until, ''));
                      }
                    }}
                  >
                    {isPaused ? '▶️' : '⏸'}
                  </button>
                  {task.status === 'done' && task.recurrence_type === 'none' && (
                    <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => startTransition(() => reopenTask(task.id, containerId))}>
                      ↺
                    </button>
                  )}
                  {!confirmingDelete ? (
                    <button className="btn btn-ghost !px-2 !py-1 text-xs text-fresh-low" onClick={() => setConfirmingDelete(true)}>
                      🗑
                    </button>
                  ) : (
                    <span className="flex items-center gap-1 text-xs">
                      <button
                        className="btn btn-primary !px-2 !py-1 !bg-fresh-low text-xs"
                        onClick={() => startTransition(() => deleteTask(task.id, containerId))}
                      >
                        Supprimer
                      </button>
                      <button className="btn btn-ghost !px-2 !py-1 text-xs" onClick={() => setConfirmingDelete(false)}>
                        Annuler
                      </button>
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          <ChecklistSection taskId={task.id} containerId={containerId} items={task.checklist} canEdit={canEdit} templates={checklistTemplates} />
        </div>
      )}

      {completing && (
        <form
          className="flex flex-col gap-2 rounded-lg border border-[var(--border)] p-3"
          action={(fd) =>
            startTransition(async () => {
              await completeTask(task.id, containerId, fd);
              setCompleting(false);
            })
          }
        >
          <label className="text-xs font-medium">
            Faite le (si oubliée, indiquer une date antérieure)
            <input name="completedAt" type="date" defaultValue={todayISO()} max={todayISO()} className="input mt-1 w-full" />
          </label>
          <label className="text-xs font-medium">
            Commentaire (optionnel)
            <input name="comment" className="input mt-1 w-full" placeholder="Tout est fait !" />
          </label>
          <label className="text-xs font-medium">
            Photo (optionnel)
            <input name="photo" type="file" accept="image/*" className="input mt-1 w-full" />
          </label>
          <div className="flex gap-2">
            <button type="submit" disabled={pending} className="btn btn-primary !py-1 text-sm">
              Valider
            </button>
            <button type="button" className="btn btn-ghost !py-1 text-sm" onClick={() => setCompleting(false)}>
              Annuler
            </button>
          </div>
        </form>
      )}

      {expanded && depth === 0 && (
        <div className="flex flex-col gap-2 pl-2">
          {task.subtasks.map((sub) => (
            <TaskRow
              key={sub.id}
              task={sub}
              containerId={containerId}
              members={members}
              rooms={rooms}
              currentUserId={currentUserId}
              isGuest={isGuest}
              canEdit={canEdit}
              checklistTemplates={checklistTemplates}
              depth={1}
            />
          ))}
          {canEdit && !addingSub && (
            <button
              className="self-start text-xs text-[var(--text-muted)] hover:underline"
              onClick={() => {
                setSubtaskError(null);
                setAddingSub(true);
              }}
            >
              + sous-tâche
            </button>
          )}
          {canEdit && addingSub && (
            <div className="flex flex-col gap-1">
              <form
                className="flex items-center gap-2"
                action={(fd) =>
                  startTransition(async () => {
                    fd.set('parentTaskId', task.id);
                    const res = await createTask(containerId, fd);
                    if (res?.error) {
                      setSubtaskError(res.error);
                      return;
                    }
                    setSubtaskError(null);
                    setAddingSub(false);
                  })
                }
              >
                <input name="title" required autoFocus placeholder="Titre de la sous-tâche" className="input flex-1 !py-1 text-sm" />
                <button type="submit" disabled={pending} className="btn btn-primary !py-1 text-sm">
                  Ajouter
                </button>
                <button type="button" className="btn btn-ghost !py-1 text-sm" onClick={() => setAddingSub(false)}>
                  ✕
                </button>
              </form>
              {subtaskError && <p className="text-xs text-fresh-low">{subtaskError}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
