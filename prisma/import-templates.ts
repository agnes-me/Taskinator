import { PrismaClient } from '@prisma/client';
import data from './data/menage-templates.json';

type ImportedItem = {
  title: string;
  zoneName: string;
  description: string | null;
  recurrenceType: string | null;
  recurrenceInterval: number | null;
  priority: string | null;
  sortOrder: number;
};

type ImportedTemplate = {
  name: string;
  icon: string;
  description: string;
  defaultCategoryName: string;
  defaultCategoryIcon: string;
  defaultCategoryColor: string;
  defaultCategoryKind: string;
  items: ImportedItem[];
};

/**
 * Importe le catalogue de tâches de ménage/entretien (issu d'un export Excel) comme
 * templates système (householdId null), utilisables par tous les foyers. Idempotent :
 * un template déjà présent (même nom, système) n'est pas recréé. Appelé depuis le
 * script de seed (à chaque déploiement) et exécutable seul via `npm run db:import-templates`.
 */
export async function importChoreTemplates(prisma: PrismaClient) {
  const templates = data as ImportedTemplate[];

  for (const t of templates) {
    const existing = await prisma.taskTemplate.findFirst({
      where: { householdId: null, name: t.name },
    });
    if (existing) {
      console.log(`Template système déjà présent, ignoré : ${t.name}`);
      continue;
    }

    await prisma.taskTemplate.create({
      data: {
        householdId: null,
        isSystem: true,
        name: t.name,
        description: t.description,
        icon: t.icon,
        type: 'CHECKLIST',
        defaultCategoryName: t.defaultCategoryName,
        defaultCategoryIcon: t.defaultCategoryIcon,
        defaultCategoryColor: t.defaultCategoryColor,
        defaultCategoryKind: t.defaultCategoryKind,
        items: {
          create: t.items.map((item) => ({
            title: item.title,
            description: item.description,
            zoneName: item.zoneName,
            recurrenceType: item.recurrenceType,
            recurrenceInterval: item.recurrenceInterval,
            priority: item.priority,
            sortOrder: item.sortOrder,
          })),
        },
      },
    });
    console.log(`Template système importé : ${t.name} (${t.items.length} tâches)`);
  }
}

if (require.main === module) {
  const prisma = new PrismaClient();
  importChoreTemplates(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
