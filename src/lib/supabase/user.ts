import { cache } from 'react';
import { createClient } from './server';

/**
 * `supabase.auth.getUser()` revalide le JWT auprès du serveur d'auth à chaque appel (ce
 * n'est pas une simple lecture de cookie). Sans mémoïsation, une seule navigation qui
 * traverse plusieurs layouts/pages (chacun voulant "l'utilisateur courant") déclenchait
 * jusqu'à 3 allers-retours réseau redondants. `cache()` de React ne mémoïse que pour la
 * durée d'un seul rendu serveur (une requête) — aucune fuite entre utilisateurs.
 */
export const getAuthUser = cache(async () => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
});
