-- containers_update exigeait is_container_admin(id) (rôle 'admin' strict), mais l'app autorise déjà
-- les membres 'member' à modifier un conteneur côté UI (pause/reprise, et désormais édition du
-- nom/icône/couleur) : un membre non-admin se voyait donc proposer un bouton qui échouait
-- silencieusement en base. On aligne la policy sur le même seuil que le reste de l'app.
drop policy containers_update on containers;
create policy containers_update on containers for update
  using (container_role(id) in ('admin', 'member'))
  with check (container_role(id) in ('admin', 'member'));
