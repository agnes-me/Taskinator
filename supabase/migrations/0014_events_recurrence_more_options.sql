-- Complète la périodicité des événements : au-delà de "tous les ans" (anniversaires), on peut
-- aussi vouloir "toutes les semaines" (ex. réunion récurrente) ou "tous les mois".
alter table events drop constraint events_recurrence_type_check;
alter table events add constraint events_recurrence_type_check check (recurrence_type in ('none', 'weekly', 'monthly', 'yearly'));
