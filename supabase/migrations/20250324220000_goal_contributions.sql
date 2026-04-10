-- Historique des contributions aux objectifs (audit + affichage)

create table public.goal_contributions (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  contributed_at timestamptz not null default now(),
  note text
);

create index goal_contributions_goal_idx
  on public.goal_contributions (goal_id, contributed_at desc);

alter table public.goal_contributions enable row level security;

create policy goal_contributions_all on public.goal_contributions
  for all
  using (public.is_household_member (household_id, auth.uid ()))
  with check (public.is_household_member (household_id, auth.uid ()));
