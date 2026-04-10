-- Sprint suivant : projets foyer (futur/en cours/termine/archive), priorite, notes, URLs
-- et cadence recurrente plus souple.

alter type public.recurring_cadence add value if not exists 'weekly';
alter type public.recurring_cadence add value if not exists 'yearly';

alter table public.goals
  add column if not exists status text not null default 'in_progress'
    check (status in ('future', 'in_progress', 'done', 'archived')),
  add column if not exists priority text not null default 'medium'
    check (priority in ('high', 'medium', 'low')),
  add column if not exists estimated_amount numeric(14, 2)
    check (estimated_amount is null or estimated_amount >= 0),
  add column if not exists note text,
  add column if not exists links jsonb not null default '[]'::jsonb;

update public.goals
set status = case
  when archived_at is not null then 'archived'
  else 'in_progress'
end
where status is distinct from case
  when archived_at is not null then 'archived'
  else 'in_progress'
end;

comment on column public.goals.status is
  'Etat du projet foyer : future, in_progress, done, archived';

comment on column public.goals.priority is
  'Priorite du projet foyer : high, medium, low';

comment on column public.goals.estimated_amount is
  'Prix estime optionnel (utile pour wishlist/projets futurs)';

comment on column public.goals.note is
  'Note libre du foyer sur le projet';

comment on column public.goals.links is
  'Liens URL utiles (produit, inspiration, reservation...)';
