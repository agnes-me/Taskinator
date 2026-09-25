-- Jusqu'ici, seul le créateur d'un template pouvait le supprimer (room_templates_delete /
-- event_templates_delete), y compris une fois publié sur la marketplace — la modération ne
-- pouvait donc qu'approuver/refuser les templates en attente, jamais retirer un template déjà
-- publié. On aligne les policies DELETE sur room_template_editable/event_template_editable,
-- qui autorisent déjà la super-admin (is_super_admin(), cf. 0001_init.sql) pour la modification.

drop policy room_templates_delete on room_templates;
create policy room_templates_delete on room_templates for delete using (created_by = auth.uid() or is_super_admin());

drop policy event_templates_delete on event_templates;
create policy event_templates_delete on event_templates for delete using (created_by = auth.uid() or is_super_admin());
