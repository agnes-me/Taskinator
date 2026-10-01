-- Remplace le "groupe" en texte libre par une vraie hiérarchie de cases à cocher (chaque ligne
-- est cochable, avec ou sans sous-cases en dessous) : plus cohérent avec le reste de l'app (même
-- logique que les sous-tâches, en plus léger) et plus flexible qu'un simple libellé de groupe.
alter table checklist_items drop column group_name;
alter table checklist_items add column parent_item_id uuid references checklist_items(id) on delete cascade;
create index on checklist_items (parent_item_id);

alter table checklist_template_items drop column group_name;
alter table checklist_template_items add column parent_item_id uuid references checklist_template_items(id) on delete cascade;
create index on checklist_template_items (parent_item_id);
