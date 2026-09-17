import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCurrentHousehold, getUserHouseholds } from '@/lib/current-household';
import { ensurePersonalHousehold } from '@/lib/ensure-personal-household';
import { NavBar } from '@/components/NavBar';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect('/login');
  }

  const household = await getCurrentHousehold(session.user.id);
  if (!household) {
    redirect('/register');
  }

  let households = await getUserHouseholds(session.user.id);
  // Comptes créés avant l'introduction du conteneur perso : on le crée à la volée.
  if (!households.some((h) => h.household.isPersonal)) {
    await ensurePersonalHousehold(session.user.id, session.user.name ?? 'Moi');
    households = await getUserHouseholds(session.user.id);
  }

  return (
    <div className="min-h-screen pb-16 md:pb-0">
      <NavBar
        activeHousehold={{ id: household.id, name: household.name }}
        households={households.map((h) => ({ id: h.household.id, name: h.household.name }))}
      />
      <main className="mx-auto max-w-5xl px-4 py-6">{children}</main>
    </div>
  );
}
