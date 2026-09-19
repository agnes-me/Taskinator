-- Dégradé de couleurs personnalisable par utilisatrice (2 à 5 couleurs), appliqué aux
-- boutons principaux et à l'en-tête de l'appli. S'assombrit automatiquement en mode sombre
-- (cf. src/app/globals.css) plutôt que de demander un second jeu de couleurs.

alter table profiles
  add column theme_gradient text[] not null default array['#14b8a6', '#6366f1'];

alter table profiles
  add constraint theme_gradient_length check (array_length(theme_gradient, 1) between 2 and 5);

-- Postgres n'autorise pas de sous-requête dans un CHECK simple : validation du format
-- hexadécimal de chaque couleur via une fonction plutôt qu'un CHECK direct.
create function public.validate_hex_colors(colors text[]) returns boolean
language sql immutable as $$
  select bool_and(c ~ '^#[0-9a-fA-F]{6}$') from unnest(colors) as c;
$$;

alter table profiles
  add constraint theme_gradient_hex check (validate_hex_colors(theme_gradient));

grant execute on function public.validate_hex_colors(text[]) to authenticated;
