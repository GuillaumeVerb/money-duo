-- Notes de décision : rappel optionnel
alter table public.decision_notes
  add column if not exists remind_at date;

comment on column public.decision_notes.remind_at is
  'Date optionnelle pour se reparler du sujet (affichage / rappels futurs).';

-- Qui a saisi la dépense (charge mentale / transparence)
alter table public.expenses
  add column if not exists created_by_member_id uuid references public.household_members (id) on delete set null;

create index if not exists expenses_created_by_member_idx
  on public.expenses (household_id, created_by_member_id)
  where created_by_member_id is not null;

comment on column public.expenses.created_by_member_id is
  'Membre connecté ayant enregistré la ligne (approximation utile charge mentale).';
