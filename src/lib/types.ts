// SQLite (choisi pour un démarrage sans dépendance externe) ne supporte pas les enums natifs Prisma.
// Ces champs sont donc stockés en String côté base ; ces types donnent la sécurité TypeScript côté code.

export type Role = 'OWNER' | 'MEMBER';

export type CategoryKind = 'CHORE' | 'SHOPPING' | 'PACKING' | 'EVENT' | 'ADMIN' | 'OTHER';

export type RecurrenceType = 'NONE' | 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'CUSTOM_DAYS';

export type TaskStatus = 'TODO' | 'DONE' | 'SKIPPED';

export type Priority = 'LOW' | 'MEDIUM' | 'HIGH';

export type TemplateType = 'CHECKLIST' | 'EVENT_PLANNING';
