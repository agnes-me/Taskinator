import { PrismaClient } from '@prisma/client';
import zoneData from './data/zone-templates.json';

type ZoneImportedItem = {
  title: string;
  description: string | null;
  recurrenceType: string | null;
  recurrenceInterval: number | null;
  priority: string | null;
  sortOrder: number;
};

type ZoneImportedTemplate = {
  name: string;
  icon: string;
  description: string;
  defaultCategoryName: string;
  defaultCategoryIcon: string;
  defaultCategoryColor: string;
  defaultCategoryKind: string;
  items: ZoneImportedItem[];
};

// Anciens templates système "par feuille" (remplacés par un template par zone).
const OLD_SHEET_TEMPLATE_NAMES = [
  'Ménage - Intérieur',
  'Extérieur - Jardin - Garage',
  'Entretien technique maison',
  'Véhicule',
  'Autre - Divers',
];

/**
 * Importe le catalogue de tâches de ménage/entretien comme templates système
 * (householdId null), un template par zone (ex: "Cuisine", "Garage"...), pour être
 * proposés automatiquement quand on crée une zone de ce type. Idempotent : supprime les
 * anciens templates "par feuille" s'ils existent encore, puis ignore un template déjà
 * importé. Appelé depuis le script de seed (à chaque déploiement) et exécutable seul via
 * `npm run db:import-templates`.
 */
export async function importChoreTemplates(prisma: PrismaClient) {
  const deleted = await prisma.taskTemplate.deleteMany({
    where: { householdId: null, name: { in: OLD_SHEET_TEMPLATE_NAMES } },
  });
  if (deleted.count > 0) {
    console.log(`Anciens templates système (par feuille) supprimés : ${deleted.count}`);
  }

  const templates = zoneData as ZoneImportedTemplate[];

  for (const t of templates) {
    const existing = await prisma.taskTemplate.findFirst({
      where: { householdId: null, name: t.name, type: 'ZONE_CHECKLIST' },
    });
    if (existing) {
      console.log(`Template de zone déjà présent, ignoré : ${t.name}`);
      continue;
    }

    await prisma.taskTemplate.create({
      data: {
        householdId: null,
        isSystem: true,
        name: t.name,
        description: t.description,
        icon: t.icon,
        type: 'ZONE_CHECKLIST',
        defaultCategoryName: t.defaultCategoryName,
        defaultCategoryIcon: t.defaultCategoryIcon,
        defaultCategoryColor: t.defaultCategoryColor,
        defaultCategoryKind: t.defaultCategoryKind,
        items: {
          create: t.items.map((item) => ({
            title: item.title,
            description: item.description,
            recurrenceType: item.recurrenceType,
            recurrenceInterval: item.recurrenceInterval,
            priority: item.priority,
            sortOrder: item.sortOrder,
          })),
        },
      },
    });
    console.log(`Template de zone importé : ${t.name} (${t.items.length} tâches)`);
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
