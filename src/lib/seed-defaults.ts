import { prisma } from '@/lib/prisma';
import type { CategoryKind } from '@/lib/types';

const DEFAULT_ZONES = [
  { name: 'Cuisine', icon: '🍳' },
  { name: 'Salon', icon: '🛋️' },
  { name: 'Chambres', icon: '🛏️' },
  { name: 'Salle de bain', icon: '🛁' },
  { name: 'Extérieur / Jardin', icon: '🌿' },
  { name: 'Bureau', icon: '🗄️' },
];

const DEFAULT_CATEGORIES: { name: string; icon: string; color: string; kind: CategoryKind }[] = [
  { name: 'Ménage', icon: '🧹', color: '#0d9488', kind: 'CHORE' },
  { name: 'Courses', icon: '🛒', color: '#f59e0b', kind: 'SHOPPING' },
  { name: 'Valises / Affaires', icon: '🎒', color: '#8b5cf6', kind: 'PACKING' },
  { name: 'Évènements', icon: '🎉', color: '#ec4899', kind: 'EVENT' },
  { name: 'Administratif', icon: '📄', color: '#3b82f6', kind: 'ADMIN' },
  { name: 'Autre', icon: '📌', color: '#6b7280', kind: 'OTHER' },
];

/** Crée les zones, catégories et templates de départ pour un nouveau foyer. */
export async function seedDefaultsForHousehold(householdId: string) {
  await prisma.zone.createMany({
    data: DEFAULT_ZONES.map((z, i) => ({ ...z, householdId, sortOrder: i })),
  });

  const categories = await Promise.all(
    DEFAULT_CATEGORIES.map((c, i) =>
      prisma.category.create({ data: { ...c, householdId, sortOrder: i } }),
    ),
  );

  const packingCategory = categories.find((c) => c.kind === 'PACKING');
  const eventCategory = categories.find((c) => c.kind === 'EVENT');
  const shoppingCategory = categories.find((c) => c.kind === 'SHOPPING');

  await prisma.taskTemplate.create({
    data: {
      householdId,
      name: 'Valise de vacances',
      description: 'Liste type à personnaliser, une par personne (ou par enfant).',
      icon: '🧳',
      type: 'CHECKLIST',
      items: {
        create: [
          'Vêtements pour la durée du séjour',
          'Pyjama',
          'Sous-vêtements & chaussettes',
          'Trousse de toilette',
          'Doudou / objet réconfort',
          'Chaussures de rechange',
          'Maillot de bain',
          'Médicaments / ordonnances',
          'Chargeurs & électronique',
          "Livre / jeu pour le trajet",
        ].map((title, i) => ({
          title,
          perPerson: true,
          categoryId: packingCategory?.id,
          sortOrder: i,
        })),
      },
    },
  });

  await prisma.taskTemplate.create({
    data: {
      householdId,
      name: 'Recevoir des invités',
      description: 'Rétroplanning pour préparer une réception (calé sur la date de l\'évènement).',
      icon: '🥂',
      type: 'EVENT_PLANNING',
      items: {
        create: [
          { title: 'Envoyer les invitations', offsetDays: -14 },
          { title: 'Confirmer le nombre de convives', offsetDays: -7 },
          { title: 'Établir le menu', offsetDays: -6 },
          { title: 'Faire la liste de courses', offsetDays: -3 },
          { title: 'Faire les courses', offsetDays: -1 },
          { title: 'Ranger et nettoyer la maison', offsetDays: -1 },
          { title: 'Préparer la table / décoration', offsetDays: -1 },
          { title: 'Préparer les plats à l\'avance', offsetDays: 0 },
          { title: "Mettre le vin / boissons au frais", offsetDays: 0 },
          { title: 'Rangement après réception', offsetDays: 1 },
        ].map((item, i) => ({ ...item, categoryId: eventCategory?.id, sortOrder: i })),
      },
    },
  });

  await prisma.taskTemplate.create({
    data: {
      householdId,
      name: 'Courses pour un repas',
      description: 'Liste de courses type pour préparer un repas à une date donnée.',
      icon: '🍽️',
      type: 'EVENT_PLANNING',
      items: {
        create: [
          { title: 'Entrée : ingrédients', offsetDays: -1 },
          { title: 'Plat principal : ingrédients', offsetDays: -1 },
          { title: 'Dessert : ingrédients', offsetDays: -1 },
          { title: 'Pain / boissons', offsetDays: 0 },
        ].map((item, i) => ({ ...item, categoryId: shoppingCategory?.id, sortOrder: i })),
      },
    },
  });
}
