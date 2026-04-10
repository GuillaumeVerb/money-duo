-- Notes du « contrat » foyer (non juridique — alignement couple).
alter table public.households
  add column if not exists charter_notes text;

comment on column public.households.charter_notes is
  'Notes communes : ce qui est partagé, ce qui reste perso, intentions simples.';

-- Objectifs archivés (hors cockpit principal, conservés en historique).
alter table public.goals
  add column if not exists archived_at timestamptz;

comment on column public.goals.archived_at is
  'Si non null, l’objectif est archivé (masqué du cockpit par défaut).';

-- Qui a enregistré la contribution (optionnel, pour l’historique).
alter table public.goal_contributions
  add column if not exists member_id uuid references public.household_members (id) on delete set null;

comment on column public.goal_contributions.member_id is
  'Membre ayant saisi la contribution (affichage historique).';
