import { requireSessionAndHousehold } from '@/lib/require-session';
import { getUserHouseholds } from '@/lib/current-household';
import { createContainer, joinContainer, switchContainer } from './actions';

const ROLE_LABELS: Record<string, string> = { OWNER: 'Propriétaire', MEMBER: 'Membre' };

export default async function ContainersPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const { userId, household: activeHousehold } = await requireSessionAndHousehold();
  const households = await getUserHouseholds(userId);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Mes conteneurs</h1>
        <p className="text-sm text-slate-500">
          Un conteneur (foyer, association, projet...) a ses propres tâches, templates,
          membres et calendrier. Vous pouvez en créer plusieurs (ex: un pour la maison, un
          pour vos évènements pro) et partager chacun séparément.
        </p>
      </div>

      {error && (
        <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {households.map(({ household, role }) => {
          const isActive = household.id === activeHousehold.id;
          return (
            <div key={household.id} className={`card ${isActive ? 'border-brand-500' : ''}`}>
              <div className="flex items-center justify-between">
                <span className="font-medium">{household.name}</span>
                {isActive && (
                  <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                    Actif
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs text-slate-400">
                {ROLE_LABELS[role]} · {household._count.memberships} membre(s)
              </p>
              {!isActive && (
                <form action={switchContainer} className="mt-3">
                  <input type="hidden" name="householdId" value={household.id} />
                  <button className="btn-secondary w-full text-sm">Passer à celui-ci</button>
                </form>
              )}
            </div>
          );
        })}
      </div>

      <section className="card space-y-3">
        <h2 className="font-semibold">➕ Créer un nouveau conteneur</h2>
        <form action={createContainer} className="flex flex-wrap items-end gap-2">
          <input className="input flex-1" name="name" placeholder="Ex: Association, Bureau, Chalet..." required />
          <button className="btn-primary">Créer</button>
        </form>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold">🔑 Rejoindre un conteneur existant</h2>
        <form action={joinContainer} className="flex flex-wrap items-end gap-2">
          <input className="input flex-1 uppercase" name="inviteCode" placeholder="Code d'invitation" required />
          <button className="btn-secondary">Rejoindre</button>
        </form>
      </section>
    </div>
  );
}
