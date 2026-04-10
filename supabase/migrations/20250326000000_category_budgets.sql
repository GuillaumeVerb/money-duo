-- Budget mensuel optionnel par catégorie (plafond pour le mois civil en cours, comparé aux dépenses du mois).

create table public.category_budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  monthly_cap numeric(14, 2) not null check (monthly_cap > 0),
  created_at timestamptz not null default now(),
  unique (household_id, category_id)
);

create index category_budgets_household_idx on public.category_budgets (household_id);

alter table public.category_budgets enable row level security;

create policy category_budgets_all on public.category_budgets
  for all using (public.is_household_member (household_id, auth.uid()))
  with check (public.is_household_member (household_id, auth.uid()));

comment on table public.category_budgets is
  'Plafond mensuel par catégorie : comparé aux dépenses du même mois civil (spent_at).';
