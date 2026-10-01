/**
 * Importe la bibliothèque de templates de pièce système (Cuisine, Salle de bain, Jardin...)
 * dans le catalogue public, visible par toutes les utilisatrices de l'appli.
 *
 * Usage : npm run db:seed-templates
 * Nécessite SUPABASE_SERVICE_ROLE_KEY (contourne la RLS, écrit en tant que catalogue système).
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY sont requis (voir .env.example).');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

type SeedItem = {
  title: string;
  description: string | null;
  recurrence_type: string;
  recurrence_interval: number;
  priority: string;
  sort_order: number;
};
type SeedTemplate = { name: string; icon: string; items: SeedItem[] };

async function main() {
  const dataPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'data', 'room-templates.json');
  const templates: SeedTemplate[] = JSON.parse(readFileSync(dataPath, 'utf-8'));

  for (const tpl of templates) {
    const { data: existing } = await supabase
      .from('room_templates')
      .select('id')
      .eq('is_system', true)
      .eq('name', tpl.name)
      .maybeSingle();

    let templateId = existing?.id as string | undefined;

    if (templateId) {
      await supabase.from('room_template_items').delete().eq('template_id', templateId);
    } else {
      const { data: inserted, error } = await supabase
        .from('room_templates')
        .insert({
          name: tpl.name,
          icon: tpl.icon,
          is_system: true,
          visibility: 'public',
          moderation_status: 'approved',
        })
        .select('id')
        .single();
      if (error || !inserted) {
        console.error(`Erreur création template "${tpl.name}" :`, error);
        continue;
      }
      templateId = inserted.id;
    }

    const rows = tpl.items.map((item) => ({ ...item, template_id: templateId }));
    const { error: itemsError } = await supabase.from('room_template_items').insert(rows);
    if (itemsError) {
      console.error(`Erreur insertion des tâches de "${tpl.name}" :`, itemsError);
      continue;
    }
    console.log(`✓ ${tpl.name} (${rows.length} tâches)`);
  }

  console.log(`Import terminé : ${templates.length} templates de pièce.`);
}

main().then(
  () => process.exit(0),
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
