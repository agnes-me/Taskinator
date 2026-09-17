import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

function code(length = 6) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
}

function token(length = 32) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

async function main() {
  const existing = await prisma.user.findUnique({ where: { email: 'demo@taskinator.local' } });
  if (existing) {
    console.log('Le jeu de données de démo existe déjà, rien à faire.');
    return;
  }

  const passwordHash = await bcrypt.hash('demo1234', 10);
  const user = await prisma.user.create({
    data: { name: 'Agnès', email: 'demo@taskinator.local', passwordHash },
  });

  const household = await prisma.household.create({
    data: { name: 'Maison Démo', inviteCode: code(), icsToken: token() },
  });

  await prisma.membership.create({ data: { userId: user.id, householdId: household.id, role: 'OWNER' } });
  const parentProfile = await prisma.profile.create({
    data: { householdId: household.id, displayName: 'Agnès', linkedUserId: user.id },
  });
  const child1 = await prisma.profile.create({
    data: { householdId: household.id, displayName: 'Léo', isChild: true, color: '#f59e0b' },
  });
  const child2 = await prisma.profile.create({
    data: { householdId: household.id, displayName: 'Mia', isChild: true, color: '#ec4899' },
  });

  const kitchen = await prisma.zone.create({ data: { householdId: household.id, name: 'Cuisine', icon: '🍳' } });
  const bathroom = await prisma.zone.create({
    data: { householdId: household.id, name: 'Salle de bain', icon: '🛁' },
  });

  const chore = await prisma.category.create({
    data: { householdId: household.id, name: 'Ménage', icon: '🧹', color: '#0d9488', kind: 'CHORE' },
  });
  const shopping = await prisma.category.create({
    data: { householdId: household.id, name: 'Courses', icon: '🛒', color: '#f59e0b', kind: 'SHOPPING' },
  });
  const packing = await prisma.category.create({
    data: { householdId: household.id, name: 'Valises', icon: '🎒', color: '#8b5cf6', kind: 'PACKING' },
  });
  const eventCat = await prisma.category.create({
    data: { householdId: household.id, name: 'Évènements', icon: '🎉', color: '#ec4899', kind: 'EVENT' },
  });

  await prisma.task.create({
    data: {
      householdId: household.id,
      title: 'Nettoyer le plan de travail',
      categoryId: chore.id,
      zoneId: kitchen.id,
      assigneeId: parentProfile.id,
      createdByUserId: user.id,
      recurrenceType: 'DAILY',
      recurrenceInterval: 1,
      dueDate: new Date(),
    },
  });

  await prisma.task.create({
    data: {
      householdId: household.id,
      title: 'Changer les serviettes',
      categoryId: chore.id,
      zoneId: bathroom.id,
      createdByUserId: user.id,
      recurrenceType: 'WEEKLY',
      recurrenceWeekdays: '1',
      dueDate: new Date(),
    },
  });

  await prisma.task.create({
    data: {
      householdId: household.id,
      title: 'Courses de la semaine',
      categoryId: shopping.id,
      createdByUserId: user.id,
      recurrenceType: 'WEEKLY',
      recurrenceWeekdays: '6',
      dueDate: new Date(Date.now() + 2 * 86400000),
    },
  });

  const packingTemplate = await prisma.taskTemplate.create({
    data: {
      householdId: household.id,
      name: 'Valise de vacances',
      description: 'Une liste par enfant, à personnaliser.',
      icon: '🧳',
      type: 'CHECKLIST',
      items: {
        create: [
          { title: 'Vêtements', perPerson: true, categoryId: packing.id, sortOrder: 0 },
          { title: 'Doudou / jouet', perPerson: true, categoryId: packing.id, sortOrder: 1 },
          { title: 'Trousse de toilette', perPerson: true, categoryId: packing.id, sortOrder: 2 },
        ],
      },
    },
  });

  const hostingTemplate = await prisma.taskTemplate.create({
    data: {
      householdId: household.id,
      name: 'Recevoir des invités',
      description: "Rétroplanning calé sur la date de l'évènement.",
      icon: '🥂',
      type: 'EVENT_PLANNING',
      items: {
        create: [
          { title: 'Envoyer les invitations', offsetDays: -14, categoryId: eventCat.id, sortOrder: 0 },
          { title: 'Faire la liste de courses', offsetDays: -3, categoryId: shopping.id, sortOrder: 1 },
          { title: 'Faire les courses', offsetDays: -1, categoryId: shopping.id, sortOrder: 2 },
          { title: 'Ranger la maison', offsetDays: -1, categoryId: chore.id, sortOrder: 3 },
        ],
      },
    },
  });

  const eventDate = new Date(Date.now() + 20 * 86400000);
  const event = await prisma.event.create({
    data: {
      householdId: household.id,
      name: 'Vacances à la mer',
      eventDate,
      templateId: packingTemplate.id,
      createdByUserId: user.id,
    },
  });

  const packingItems = await prisma.taskTemplateItem.findMany({ where: { templateId: packingTemplate.id } });
  for (const item of packingItems) {
    for (const profile of [child1, child2]) {
      await prisma.task.create({
        data: {
          householdId: household.id,
          title: `${item.title} — ${profile.displayName}`,
          categoryId: item.categoryId,
          assigneeId: profile.id,
          eventId: event.id,
          templateItemId: item.id,
          dueDate: eventDate,
          createdByUserId: user.id,
        },
      });
    }
  }

  console.log('Jeu de données de démo créé.');
  console.log('Connexion : demo@taskinator.local / demo1234');
  console.log(`Code d'invitation du foyer : ${household.inviteCode}`);
  console.log(`Template "Recevoir des invités" prêt à être utilisé (id: ${hostingTemplate.id}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
