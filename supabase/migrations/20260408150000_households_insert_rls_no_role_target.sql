-- RLS insert households : variante sans "TO authenticated"
-- (certaines configs refusent l’insert si seule une politique ciblant "authenticated" matche mal le rôle effectif).
drop policy if exists households_insert on public.households;

create policy households_insert on public.households
  for insert
  with check ((select auth.uid()) is not null);

comment on policy households_insert on public.households is
  'Tout client avec JWT utilisateur (auth.uid défini) peut créer une ligne households.';
