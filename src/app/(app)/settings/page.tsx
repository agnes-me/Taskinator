import { prisma } from '@/lib/prisma';
import { requireSessionAndHousehold } from '@/lib/require-session';
import {
  addProfile,
  createCategory,
  createZone,
  deleteCategory,
  deleteZone,
  pauseReminders,
  removeProfile,
  resumeReminders,
  updateHouseholdName,
} from './actions';

const KIND_LABELS: Record<string, string> = {
  CHORE: 'Ménage',
  SHOPPING: 'Courses',
  PACKING: 'Valises',
  EVENT: 'Évènement',
  ADMIN: 'Administratif',
  OTHER: 'Autre',
};

export default async function SettingsPage() {
  const { household } = await requireSessionAndHousehold();

  const [zones, categories, profiles, freshHousehold] = await Promise.all([
    prisma.zone.findMany({ where: { householdId: household.id }, orderBy: { sortOrder: 'asc' } }),
    prisma.category.findMany({ where: { householdId: household.id }, orderBy: { sortOrder: 'asc' } }),
    prisma.profile.findMany({ where: { householdId: household.id }, orderBy: { createdAt: 'asc' } }),
    prisma.household.findUnique({ where: { id: household.id } }),
  ]);

  const icsUrl = `/api/calendar/${household.id}/${freshHousehold?.icsToken}.ics`;
  const paused = freshHousehold?.remindersPausedUntil && freshHousehold.remindersPausedUntil > new Date();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Réglages du foyer</h1>

      <section className="card space-y-4">
        <h2 className="font-semibold">Foyer</h2>
        <form action={updateHouseholdName} className="flex flex-wrap items-end gap-2">
          <div className="flex-1">
            <label className="label">Nom du foyer</label>
            <input className="input" name="name" defaultValue={household.name} />
          </div>
          <button className="btn-primary">Enregistrer</button>
        </form>
        <div className="rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
          Code d&apos;invitation à partager :{' '}
          <span className="font-mono font-bold tracking-wider">{household.inviteCode}</span>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">📅 Synchronisation calendrier</h2>
        <p className="text-sm text-slate-500">
          Abonnez Google Calendar, Apple Calendar ou Outlook à ce flux pour voir toutes les tâches datées du foyer.
        </p>
        <div className="rounded-lg bg-slate-50 p-3 font-mono text-xs dark:bg-slate-800 break-all">{icsUrl}</div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">🌴 Pause des rappels (vacances, absence...)</h2>
        {paused ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-amber-50 p-3 text-sm dark:bg-amber-900/30">
            <span>
              Rappels en pause jusqu&apos;au{' '}
              <strong>{freshHousehold?.remindersPausedUntil?.toLocaleDateString('fr-FR')}</strong>
              {freshHousehold?.remindersPauseReason ? ` — ${freshHousehold.remindersPauseReason}` : ''}
            </span>
            <form action={resumeReminders}>
              <button className="btn-secondary text-sm">Reprendre les rappels</button>
            </form>
          </div>
        ) : (
          <form action={pauseReminders} className="flex flex-wrap items-end gap-2">
            <div>
              <label className="label">Pause jusqu&apos;au</label>
              <input className="input" type="date" name="until" required />
            </div>
            <div className="flex-1">
              <label className="label">Raison (optionnel)</label>
              <input className="input" name="reason" placeholder="Ex: vacances au ski" />
            </div>
            <button className="btn-primary">Mettre en pause</button>
          </form>
        )}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">🗺️ Zones de la maison</h2>
        <p className="text-sm text-slate-500">
          <strong>Où</strong> se fait la tâche : une pièce ou un endroit (Cuisine, Garage,
          Jardin...). Une tâche peut avoir zéro, une seule zone.
        </p>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {zones.map((zone) => (
            <li key={zone.id} className="flex items-center justify-between py-2">
              <span>
                {zone.icon} {zone.name}
              </span>
              <form action={deleteZone.bind(null, zone.id)}>
                <button className="text-sm text-red-600 hover:underline">Supprimer</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={createZone} className="flex items-end gap-2">
          <input className="input w-16" name="icon" placeholder="🏠" maxLength={4} />
          <input className="input flex-1" name="name" placeholder="Nouvelle zone (ex: Garage)" required />
          <button className="btn-secondary">Ajouter</button>
        </form>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">🏷️ Catégories</h2>
        <p className="text-sm text-slate-500">
          <strong>Quel genre</strong> de tâche c&apos;est (Ménage, Courses, Administratif...),
          indépendamment de l&apos;endroit. Ça sert à filtrer/colorer vos tâches et à les
          regrouper — deux tâches dans des zones différentes peuvent partager la même
          catégorie (ex: &quot;Passer l&apos;aspirateur&quot; au salon et à la chambre sont
          toutes les deux &quot;Ménage&quot;).
        </p>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {categories.map((category) => (
            <li key={category.id} className="flex items-center justify-between py-2">
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: category.color }}
                />
                {category.icon} {category.name}
                <span className="text-xs text-slate-400">({KIND_LABELS[category.kind]})</span>
              </span>
              <form action={deleteCategory.bind(null, category.id)}>
                <button className="text-sm text-red-600 hover:underline">Supprimer</button>
              </form>
            </li>
          ))}
        </ul>
        <form action={createCategory} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          <input className="input" name="icon" placeholder="✅" maxLength={4} />
          <input className="input col-span-2 sm:col-span-1" name="name" placeholder="Nom" required />
          <input className="input" type="color" name="color" defaultValue="#0d9488" />
          <select className="input" name="kind" defaultValue="OTHER">
            {Object.entries(KIND_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <button className="btn-secondary col-span-2 sm:col-span-1">Ajouter</button>
        </form>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">👥 Membres du foyer</h2>
        <p className="text-sm text-slate-500">
          Ajoutez les enfants ou membres sans compte : ils pourront être assignés aux tâches et listes types.
        </p>
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {profiles.map((profile) => (
            <li key={profile.id} className="flex items-center justify-between py-2">
              <span className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full"
                  style={{ backgroundColor: profile.color }}
                />
                {profile.displayName}
                {profile.isChild && <span className="text-xs text-slate-400">(enfant)</span>}
                {profile.linkedUserId && <span className="text-xs text-slate-400">(compte)</span>}
              </span>
              {!profile.linkedUserId && (
                <form action={removeProfile.bind(null, profile.id)}>
                  <button className="text-sm text-red-600 hover:underline">Supprimer</button>
                </form>
              )}
            </li>
          ))}
        </ul>
        <form action={addProfile} className="flex flex-wrap items-end gap-2">
          <input className="input flex-1" name="displayName" placeholder="Prénom" required />
          <input className="input w-16" type="color" name="color" defaultValue="#14b8a6" />
          <label className="flex items-center gap-1 text-sm">
            <input type="checkbox" name="isChild" /> Enfant
          </label>
          <button className="btn-secondary">Ajouter</button>
        </form>
      </section>
    </div>
  );
}
