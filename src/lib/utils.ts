export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '';
  return new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '';
  return new Date(value).toLocaleString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysISO(dateISO: string, days: number): string {
  const d = new Date(dateISO);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Tri chronologique (échéance la plus proche en premier, sans échéance en dernier) : utilisé pour
// les sous-tâches et les listes de type "checklist" (rétroplanning d'événement) où l'ordre
// temporel est la lecture naturelle, contrairement aux listes de tâches classées par urgence.
export function sortByDueDate<T extends { due_date: string | null }>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.due_date && b.due_date) return a.due_date < b.due_date ? -1 : a.due_date > b.due_date ? 1 : 0;
    if (a.due_date) return -1;
    if (b.due_date) return 1;
    return 0;
  });
}
