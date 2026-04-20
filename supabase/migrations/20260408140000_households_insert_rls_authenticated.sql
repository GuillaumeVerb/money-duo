-- Création de foyer depuis l’app : éviter les échecs RLS « new row violates … households »
-- quand la politique d’insert est absente, ambiguë, ou que auth.uid() doit être évalué proprement.
drop policy if exists households_insert on public.households;

create policy households_insert on public.households
  for insert
  to authenticated
  with check ((select auth.uid()) is not null);

comment on policy households_insert on public.households is
  'Un utilisateur connecté (JWT, rôle authenticated) peut créer un foyer ; les membres sont ajoutés juste après.';
