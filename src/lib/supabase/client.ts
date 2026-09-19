import { createBrowserClient } from '@supabase/ssr';

// Le générique <Database> n'est volontairement pas branché ici : le schéma "Relationships"
// attendu par les dernières versions de @supabase/supabase-js pour les jointures imbriquées
// (ex. `room:rooms(...)`) n'est pas généré (pas de CLI Supabase dans cet environnement), ce
// qui ferait dégénérer les types de sélection en `never`. src/types/database.ts documente
// néanmoins la forme des tables.
export function createClient() {
  return createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
}
