-- Enrichissement maitrise du module projets
-- (projection foyer, statuts simples, horizon, prochaine etape, focus home).

alter table public.goals
  drop constraint if exists goals_status_check;

alter table public.goals
  add constraint goals_status_check check (
    status in ('future', 'in_progress', 'paused', 'done', 'archived')
  );

alter table public.goals
  add column if not exists project_type text not null default 'shared'
    check (project_type in ('shared', 'household', 'child', 'personal_visible')),
  add column if not exists horizon text
    check (horizon is null or horizon in ('this_month', 'this_quarter', 'this_year', 'later')),
  add column if not exists next_step text,
  add column if not exists why_it_matters text,
  add column if not exists focus_on_home boolean not null default false;

comment on column public.goals.project_type is
  'Type de projet: shared, household, child, personal_visible';

comment on column public.goals.horizon is
  'Horizon souhaite: this_month, this_quarter, this_year, later';

comment on column public.goals.next_step is
  'Prochain repere concret du projet';

comment on column public.goals.why_it_matters is
  'Pourquoi ce projet compte pour le foyer';

comment on column public.goals.focus_on_home is
  'Projet mis en avant sur l ecran d accueil';
