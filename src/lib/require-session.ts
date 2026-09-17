import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getCurrentHousehold } from '@/lib/current-household';

export async function requireSessionAndHousehold() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    throw new Error('Non authentifié.');
  }
  const household = await getCurrentHousehold(session.user.id);
  if (!household) {
    throw new Error('Aucun foyer associé à ce compte.');
  }
  return { userId: session.user.id, household };
}
