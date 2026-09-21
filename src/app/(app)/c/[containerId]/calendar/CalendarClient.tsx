'use client';

import { Fragment, useTransition } from 'react';
import Link from 'next/link';
import type { CalendarTask } from '@/lib/data/tasks';
import type { GoogleEvent } from '@/lib/google-ical';
import { completeTask, reopenTask, rescheduleTask } from '@/app/(app)/c/[containerId]/tasks/actions';

export interface CalendarEvent {
  id: string;
  name: string;
  event_date: string;
}

export interface CalendarRoom {
  id: string;
  name: string;
  icon: string;
}

const PRIORITY_DOT: Record<string, string> = { low: 'bg-slate-400', medium: 'bg-amber-500', high: 'bg-rose-500' };
const WEEKDAY_LABELS = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const WEEK_HOURS = Array.from({ length: 17 }, (_, i) => i + 6); // 6h .. 22h

function toISO(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function startOfWeek(dateISO: string): Date {
  const d = new Date(`${dateISO}T00:00:00`);
  const offset = (d.getDay() + 6) % 7; // Monday = 0
  d.setDate(d.getDate() - offset);
  return d;
}

function buildHref(
  containerId: string,
  params: { view?: 'month' | 'week'; month?: string; week?: string; room?: string },
): string {
  const sp = new URLSearchParams();
  if (params.view) sp.set('view', params.view);
  if (params.month) sp.set('month', params.month);
  if (params.week) sp.set('week', params.week);
  if (params.room) sp.set('room', params.room);
  const qs = sp.toString();
  return `/c/${containerId}/calendar${qs ? `?${qs}` : ''}`;
}

export function CalendarClient({
  containerId,
  view,
  year,
  month,
  weekAnchor,
  tasks,
  events,
  googleEvents,
  googleEventsError,
  rooms,
  roomFilter,
  canEdit,
}: {
  containerId: string;
  view: 'month' | 'week';
  year: number;
  month: number;
  weekAnchor: string;
  tasks: CalendarTask[];
  events: CalendarEvent[];
  googleEvents: GoogleEvent[];
  googleEventsError: string | null;
  rooms: CalendarRoom[];
  roomFilter: string;
  canEdit: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const tasksByDate = new Map<string, CalendarTask[]>();
  for (const t of tasks) {
    const list = tasksByDate.get(t.due_date) ?? [];
    list.push(t);
    tasksByDate.set(t.due_date, list);
  }
  const eventsByDate = new Map<string, CalendarEvent[]>();
  for (const e of events) {
    const list = eventsByDate.get(e.event_date) ?? [];
    list.push(e);
    eventsByDate.set(e.event_date, list);
  }
  const googleByDate = new Map<string, GoogleEvent[]>();
  for (const g of googleEvents) {
    const list = googleByDate.get(g.date) ?? [];
    list.push(g);
    googleByDate.set(g.date, list);
  }

  function quickComplete(taskId: string) {
    startTransition(async () => {
      await completeTask(taskId, containerId, new FormData());
    });
  }

  function quickToggle(task: CalendarTask) {
    if (task.status === 'done') {
      startTransition(() => reopenTask(task.id, containerId));
    } else {
      quickComplete(task.id);
    }
  }

  function moveTaskToDay(task: CalendarTask, newDateISO: string) {
    if (task.due_date === newDateISO) return;
    startTransition(async () => {
      const patch: { due_date: string; start_at?: string | null } = { due_date: newDateISO };
      if (task.start_at) {
        const old = new Date(task.start_at);
        const [y, m, d] = newDateISO.split('-').map(Number);
        old.setFullYear(y, m - 1, d);
        patch.start_at = old.toISOString();
      }
      await rescheduleTask(task.id, containerId, patch);
    });
  }

  function scheduleTaskAt(taskId: string, dateISO: string, hour: number) {
    startTransition(async () => {
      const d = new Date(`${dateISO}T00:00:00`);
      d.setHours(hour, 0, 0, 0);
      await rescheduleTask(taskId, containerId, { due_date: dateISO, start_at: d.toISOString(), on_calendar: true });
    });
  }

  function unscheduleTaskTo(taskId: string, dateISO: string) {
    startTransition(async () => {
      await rescheduleTask(taskId, containerId, { due_date: dateISO, start_at: null, on_calendar: false });
    });
  }

  function onTaskDragStart(e: React.DragEvent, taskId: string) {
    e.dataTransfer.setData('text/plain', taskId);
    e.dataTransfer.effectAllowed = 'move';
  }

  const roomFilterChips = (
    <div className="flex flex-wrap gap-2 text-sm">
      <Link
        href={buildHref(containerId, { view, month: view === 'month' ? `${year}-${String(month + 1).padStart(2, '0')}` : undefined, week: view === 'week' ? weekAnchor : undefined })}
        className={`chip ${!roomFilter ? 'bg-container text-white' : 'bg-[var(--surface-muted)]'}`}
      >
        Toutes catégories
      </Link>
      {rooms.map((r) => (
        <Link
          key={r.id}
          href={buildHref(containerId, {
            view,
            month: view === 'month' ? `${year}-${String(month + 1).padStart(2, '0')}` : undefined,
            week: view === 'week' ? weekAnchor : undefined,
            room: r.id,
          })}
          className={`chip ${roomFilter === r.id ? 'bg-container text-white' : 'bg-[var(--surface-muted)]'}`}
        >
          {r.icon} {r.name}
        </Link>
      ))}
    </div>
  );

  const viewToggle = (
    <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 text-sm">
      <Link
        href={buildHref(containerId, { view: 'month', month: `${year}-${String(month + 1).padStart(2, '0')}`, room: roomFilter })}
        className={`rounded-lg px-3 py-1 font-medium ${view === 'month' ? 'bg-[var(--surface-muted)]' : ''}`}
      >
        Mois
      </Link>
      <Link
        href={buildHref(containerId, { view: 'week', week: weekAnchor, room: roomFilter })}
        className={`rounded-lg px-3 py-1 font-medium ${view === 'week' ? 'bg-[var(--surface-muted)]' : ''}`}
      >
        Semaine
      </Link>
    </div>
  );

  if (view === 'week') {
    const start = startOfWeek(weekAnchor);
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      return d;
    });
    const prevWeek = new Date(start);
    prevWeek.setDate(start.getDate() - 7);
    const nextWeek = new Date(start);
    nextWeek.setDate(start.getDate() + 7);
    const todayISOStr = toISO(new Date());
    const weekLabel = `${days[0].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${days[6].toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;

    return (
      <div className="flex flex-col gap-4">
        {googleEventsError && (
          <p className="rounded-lg bg-fresh-low/10 px-3 py-2 text-sm text-fresh-low">⚠️ {googleEventsError}</p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2">
          {viewToggle}
          {roomFilterChips}
        </div>

        <div className="flex items-center justify-between">
          <Link href={buildHref(containerId, { view: 'week', week: toISO(prevWeek), room: roomFilter })} className="btn btn-ghost !px-3 !py-1 text-sm">
            ←
          </Link>
          <h2 className="text-lg font-semibold capitalize">{weekLabel}</h2>
          <Link href={buildHref(containerId, { view: 'week', week: toISO(nextWeek), room: roomFilter })} className="btn btn-ghost !px-3 !py-1 text-sm">
            →
          </Link>
        </div>

        <p className="text-xs text-[var(--text-muted)]">
          Glisse une tâche sur une case pour la caler à une heure (time-blocking), même si elle n'avait pas encore d'horaire. Sur mobile,
          utilise plutôt le formulaire de modification de la tâche.
        </p>

        <div className="overflow-x-auto">
          <div className="grid min-w-[720px] grid-cols-[56px_repeat(7,1fr)] gap-px overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--border)] text-xs">
            <div className="bg-[var(--surface)]" />
            {days.map((d) => {
              const iso = toISO(d);
              const isToday = iso === todayISOStr;
              return (
                <div key={iso} className={`bg-[var(--surface)] p-1 text-center font-semibold ${isToday ? 'text-brand-600' : ''}`}>
                  {WEEKDAY_LABELS[(d.getDay() + 6) % 7]} {d.getDate()}
                </div>
              );
            })}

            <div className="bg-[var(--surface)] p-1 text-[var(--text-muted)]">Sans horaire</div>
            {days.map((d) => {
              const iso = toISO(d);
              const unscheduled = (tasksByDate.get(iso) ?? []).filter((t) => !t.start_at);
              const dayEvents = eventsByDate.get(iso) ?? [];
              const dayGoogleAllDay = (googleByDate.get(iso) ?? []).filter((g) => !g.startAt);
              return (
                <div
                  key={iso}
                  className="flex min-h-[44px] flex-col gap-0.5 bg-[var(--surface)] p-1"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const taskId = e.dataTransfer.getData('text/plain');
                    if (taskId) unscheduleTaskTo(taskId, iso);
                  }}
                >
                  {dayEvents.map((ev) => (
                    <span key={ev.id} className="truncate rounded bg-brand-500/10 px-1 py-0.5 text-brand-600" title={ev.name}>
                      🎉 {ev.name}
                    </span>
                  ))}
                  {dayGoogleAllDay.map((g) => (
                    <span key={g.id} className="truncate rounded bg-sky-500/10 px-1 py-0.5 text-sky-600" title={g.summary}>
                      🗓️ {g.summary}
                    </span>
                  ))}
                  {unscheduled.map((t) => (
                    <button
                      key={t.id}
                      draggable
                      onDragStart={(e) => onTaskDragStart(e, t.id)}
                      disabled={!canEdit || pending}
                      onClick={() => quickToggle(t)}
                      className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-left hover:bg-[var(--surface-muted)] disabled:opacity-60"
                      title={t.title}
                    >
                      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[t.priority]}`} />
                      <span className={`truncate ${t.status === 'done' ? 'line-through opacity-60' : ''}`}>{t.title}</span>
                    </button>
                  ))}
                </div>
              );
            })}

            {WEEK_HOURS.map((hour) => (
              <Fragment key={hour}>
                <div className="bg-[var(--surface)] p-1 text-[var(--text-muted)]">{hour}h</div>
                {days.map((d) => {
                  const iso = toISO(d);
                  const hourTasks = (tasksByDate.get(iso) ?? []).filter(
                    (t) => t.start_at && new Date(t.start_at).getHours() === hour,
                  );
                  const hourGoogle = (googleByDate.get(iso) ?? []).filter(
                    (g) => g.startAt && new Date(g.startAt).getHours() === hour,
                  );
                  return (
                    <div
                      key={`${iso}-${hour}`}
                      className="flex min-h-[30px] flex-col gap-0.5 bg-[var(--surface)] p-1"
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        const taskId = e.dataTransfer.getData('text/plain');
                        if (taskId) scheduleTaskAt(taskId, iso, hour);
                      }}
                    >
                      {hourGoogle.map((g) => (
                        <span key={g.id} className="truncate rounded bg-sky-500/10 px-1 py-0.5 text-sky-600" title={g.summary}>
                          🗓️ {g.summary}
                        </span>
                      ))}
                      {hourTasks.map((t) => (
                        <button
                          key={t.id}
                          draggable
                          onDragStart={(e) => onTaskDragStart(e, t.id)}
                          disabled={!canEdit || pending}
                          onClick={() => quickToggle(t)}
                          className="flex items-center gap-1 truncate rounded bg-brand-500/10 px-1 py-0.5 text-left hover:bg-brand-500/20 disabled:opacity-60"
                          title={t.title}
                        >
                          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[t.priority]}`} />
                          <span className={`truncate ${t.status === 'done' ? 'line-through opacity-60' : ''}`}>{t.title}</span>
                        </button>
                      ))}
                    </div>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const first = new Date(year, month, 1);
  const startOffset = (first.getDay() + 6) % 7;
  const gridStart = new Date(year, month, 1 - startOffset);
  const days = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    return d;
  });

  const todayISOStr = toISO(new Date());
  const prev = month === 0 ? { y: year - 1, m: 11 } : { y: year, m: month - 1 };
  const next = month === 11 ? { y: year + 1, m: 0 } : { y: year, m: month + 1 };
  const monthLabel = first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });

  return (
    <div className="flex flex-col gap-4">
      {googleEventsError && (
        <p className="rounded-lg bg-fresh-low/10 px-3 py-2 text-sm text-fresh-low">⚠️ {googleEventsError}</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {viewToggle}
        {roomFilterChips}
      </div>

      <div className="flex items-center justify-between">
        <Link
          href={buildHref(containerId, { view: 'month', month: `${prev.y}-${String(prev.m + 1).padStart(2, '0')}`, room: roomFilter })}
          className="btn btn-ghost !px-3 !py-1 text-sm"
        >
          ←
        </Link>
        <h2 className="text-lg font-semibold capitalize">{monthLabel}</h2>
        <Link
          href={buildHref(containerId, { view: 'month', month: `${next.y}-${String(next.m + 1).padStart(2, '0')}`, room: roomFilter })}
          className="btn btn-ghost !px-3 !py-1 text-sm"
        >
          →
        </Link>
      </div>

      <p className="text-xs text-[var(--text-muted)]">Glisse une tâche sur un autre jour pour la déplacer.</p>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold text-[var(--text-muted)]">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w}>{w}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((d) => {
          const iso = toISO(d);
          const inMonth = d.getMonth() === month;
          const dayTasks = tasksByDate.get(iso) ?? [];
          const dayEvents = eventsByDate.get(iso) ?? [];
          const dayGoogle = googleByDate.get(iso) ?? [];
          const isToday = iso === todayISOStr;
          return (
            <div
              key={iso}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const taskId = e.dataTransfer.getData('text/plain');
                const task = tasks.find((t) => t.id === taskId);
                if (task) moveTaskToDay(task, iso);
              }}
              className={`card flex min-h-[92px] flex-col gap-1 p-1.5 text-xs ${inMonth ? '' : 'opacity-40'} ${isToday ? '!border-brand-500' : ''}`}
            >
              <span className={`self-end text-[11px] ${isToday ? 'font-bold text-brand-600' : 'text-[var(--text-muted)]'}`}>{d.getDate()}</span>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {dayEvents.map((e) => (
                  <span key={e.id} className="truncate rounded bg-brand-500/10 px-1 py-0.5 text-[10px] text-brand-600" title={e.name}>
                    🎉 {e.name}
                  </span>
                ))}
                {dayGoogle.slice(0, 2).map((g) => (
                  <span key={g.id} className="truncate rounded bg-sky-500/10 px-1 py-0.5 text-[10px] text-sky-600" title={g.summary}>
                    🗓️ {g.summary}
                  </span>
                ))}
                {dayTasks.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    draggable
                    onDragStart={(e) => onTaskDragStart(e, t.id)}
                    disabled={!canEdit || pending}
                    onClick={() => quickToggle(t)}
                    className="flex items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[10px] hover:bg-[var(--surface-muted)] disabled:opacity-60"
                    title={`${t.title}${t.room ? ` · ${t.room.name}` : ''}${t.event ? ` · ${t.event.name}` : ''}`}
                  >
                    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_DOT[t.priority]}`} />
                    <span className={`truncate ${t.status === 'done' ? 'line-through opacity-60' : ''}`}>{t.title}</span>
                  </button>
                ))}
                {dayTasks.length > 3 && <span className="text-[10px] text-[var(--text-muted)]">+{dayTasks.length - 3}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
