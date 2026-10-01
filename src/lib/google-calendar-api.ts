// Appels directs à l'API Google Calendar v3 avec un jeton d'accès déjà valide (cf.
// getValidAccessToken dans google-oauth.ts) — contrairement à google-ical.ts (lecture seule via
// un flux .ics public), ce module lit ET écrit, avec le consentement OAuth de l'utilisateur.

const CALENDAR_API = 'https://www.googleapis.com/calendar/v3';

export interface GoogleCalendarListEntry {
  id: string;
  summary: string;
  primary?: boolean;
  accessRole: string;
}

export interface GoogleApiEvent {
  id: string;
  summary?: string;
  start?: { date?: string; dateTime?: string };
  end?: { date?: string; dateTime?: string };
}

class GoogleApiError extends Error {}

async function googleFetch(accessToken: string, path: string, init?: RequestInit) {
  const res = await fetch(`${CALENDAR_API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new GoogleApiError(`Google Calendar a répondu ${res.status} — ${text.slice(0, 300)}`);
  }
  return res;
}

/** Seuls les agendas où l'utilisateur peut écrire ont un sens pour l'édition/synchro (writer/owner). */
export async function listWritableCalendars(accessToken: string): Promise<GoogleCalendarListEntry[]> {
  const res = await googleFetch(accessToken, '/users/me/calendarList?minAccessRole=writer');
  const body = await res.json();
  return (body.items ?? []).map((c: GoogleCalendarListEntry) => ({
    id: c.id,
    summary: c.summary,
    primary: c.primary,
    accessRole: c.accessRole,
  }));
}

export async function listEvents(accessToken: string, calendarId: string, timeMinISO: string, timeMaxISO: string): Promise<GoogleApiEvent[]> {
  const url =
    `/calendars/${encodeURIComponent(calendarId)}/events?` +
    new URLSearchParams({ timeMin: timeMinISO, timeMax: timeMaxISO, singleEvents: 'true', orderBy: 'startTime', maxResults: '250' }).toString();
  const res = await googleFetch(accessToken, url);
  const body = await res.json();
  return body.items ?? [];
}

export async function createEvent(
  accessToken: string,
  calendarId: string,
  data: { summary: string; startISO: string; endISO: string; allDay?: boolean },
): Promise<GoogleApiEvent> {
  const res = await googleFetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events`, {
    method: 'POST',
    body: JSON.stringify(toGoogleEventBody(data)),
  });
  return res.json();
}

export async function updateEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  data: { summary?: string; startISO?: string; endISO?: string; allDay?: boolean },
): Promise<GoogleApiEvent> {
  const res = await googleFetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, {
    method: 'PATCH',
    body: JSON.stringify(toGoogleEventBody(data)),
  });
  return res.json();
}

export async function deleteEvent(accessToken: string, calendarId: string, eventId: string): Promise<void> {
  try {
    await googleFetch(accessToken, `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`, { method: 'DELETE' });
  } catch (e) {
    // 410 Gone : déjà supprimé côté Google (par ex. depuis l'appli Google Calendar) — pas une
    // vraie erreur de notre point de vue, l'état voulu (événement absent) est déjà atteint.
    if (e instanceof GoogleApiError && e.message.includes('410')) return;
    throw e;
  }
}

function toGoogleEventBody(data: { summary?: string; startISO?: string; endISO?: string; allDay?: boolean }) {
  const body: Record<string, unknown> = {};
  if (data.summary !== undefined) body.summary = data.summary;
  if (data.startISO !== undefined) {
    body.start = data.allDay ? { date: data.startISO.slice(0, 10) } : { dateTime: data.startISO };
  }
  if (data.endISO !== undefined) {
    body.end = data.allDay ? { date: data.endISO.slice(0, 10) } : { dateTime: data.endISO };
  }
  return body;
}
