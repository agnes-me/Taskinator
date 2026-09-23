-- Un événement peut être périodique (ex. anniversaire "tous les 15 janvier") : le calendrier
-- affiche alors sa prochaine occurrence plutôt que de devoir le recréer chaque année.
alter table events add column recurrence_type text not null default 'none' check (recurrence_type in ('none', 'yearly'));
