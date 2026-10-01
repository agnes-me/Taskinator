-- Permet à chaque utilisateur de coller l'adresse secrète iCal de son Google Calendar
-- pour voir ses événements en superposition (lecture seule) sur le calendrier Taskinator,
-- afin de repérer les collisions d'emploi du temps.
alter table profiles add column google_ical_url text;
