-- Mot du partenaire sur une dépense (réaction / commentaire court, distinct de la note de saisie).
alter table public.expenses
  add column if not exists partner_note text,
  add column if not exists partner_note_by_member_id uuid references public.household_members (id) on delete set null;

comment on column public.expenses.partner_note is
  'Message laissé par l’autre membre (vue détail dépense).';
comment on column public.expenses.partner_note_by_member_id is
  'Auteur du partner_note.';

-- Budget mensuel global du foyer (toutes dépenses du mois civil, tous types sauf si vous filtrez côté app : ici = total dépenses du mois).
alter table public.households
  add column if not exists monthly_budget_cap numeric(14, 2) check (
    monthly_budget_cap is null or monthly_budget_cap > 0
  );

comment on column public.households.monthly_budget_cap is
  'Plafond indicatif pour la somme des dépenses du mois civil (comparé au total spent_at du mois).';
