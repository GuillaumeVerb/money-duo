-- À exécuter dans Supabase Dashboard → SQL → New query (projet concerné).
-- Corrige « row-level security » / refus à la création de foyer depuis l’app.

drop policy if exists households_insert on public.households;

create policy households_insert on public.households
  for insert
  with check ((select auth.uid()) is not null);
