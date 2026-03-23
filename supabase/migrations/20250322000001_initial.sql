-- Money Duo MVP — schema, RLS, helpers (Spec V4)

create extension if not exists "pgcrypto";

-- Enums
create type public.member_role as enum ('owner', 'member');
create type public.expense_type as enum ('shared', 'personal', 'child', 'home');
create type public.split_rule_kind as enum ('equal', 'custom_percent', 'proportional_income');
create type public.recurring_cadence as enum ('monthly');
create type public.goal_owner_scope as enum ('household');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  currency text not null default 'EUR',
  default_split_rule public.split_rule_kind not null default 'equal',
  default_custom_percent numeric(5, 2) check (
    default_custom_percent is null
    or (default_custom_percent >= 0 and default_custom_percent <= 100)
  ),
  created_at timestamptz not null default now()
);

create table public.household_members (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null default 'member',
  monthly_income numeric(14, 2) check (monthly_income is null or monthly_income >= 0),
  display_name text,
  created_at timestamptz not null default now(),
  unique (household_id, user_id)
);

create index household_members_user_id_idx on public.household_members (user_id);
create index household_members_household_id_idx on public.household_members (household_id);

create table public.household_invites (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  token text not null unique,
  email text,
  invited_by uuid references auth.users (id),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index household_invites_token_idx on public.household_invites (token);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  parent_id uuid references public.categories (id) on delete set null,
  created_at timestamptz not null default now()
);

create index categories_household_id_idx on public.categories (household_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  amount numeric(14, 2) not null check (amount > 0),
  spent_at date not null default (current_date),
  payer_member_id uuid not null references public.household_members (id) on delete restrict,
  category_id uuid references public.categories (id) on delete set null,
  expense_type public.expense_type not null default 'shared',
  split_rule_snapshot public.split_rule_kind not null,
  split_custom_percent_snapshot numeric(5, 2),
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint split_custom_percent_snapshot_chk check (
    split_custom_percent_snapshot is null
    or (
      split_custom_percent_snapshot >= 0
      and split_custom_percent_snapshot <= 100
    )
  )
);

create index expenses_household_date_idx on public.expenses (household_id, spent_at desc);

create table public.expense_splits (
  id uuid primary key default gen_random_uuid(),
  expense_id uuid not null references public.expenses (id) on delete cascade,
  member_id uuid not null references public.household_members (id) on delete cascade,
  percent numeric(7, 4) not null check (percent >= 0 and percent <= 100),
  amount_due numeric(14, 2) not null check (amount_due >= 0),
  unique (expense_id, member_id)
);

create index expense_splits_expense_id_idx on public.expense_splits (expense_id);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  from_member_id uuid not null references public.household_members (id) on delete restrict,
  to_member_id uuid not null references public.household_members (id) on delete restrict,
  amount numeric(14, 2) not null check (amount > 0),
  settled_at date not null default (current_date),
  note text,
  created_at timestamptz not null default now(),
  constraint settlements_different_members check (from_member_id <> to_member_id)
);

create index settlements_household_id_idx on public.settlements (household_id, settled_at desc);

create table public.recurring_expense_templates (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  label text not null,
  amount numeric(14, 2) not null check (amount > 0),
  category_id uuid references public.categories (id) on delete set null,
  payer_member_id uuid references public.household_members (id) on delete set null,
  expense_type public.expense_type not null default 'shared',
  cadence public.recurring_cadence not null default 'monthly',
  next_occurrence date not null,
  created_at timestamptz not null default now()
);

create index recurring_household_idx on public.recurring_expense_templates (household_id);

create table public.goals (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  target_amount numeric(14, 2) not null check (target_amount > 0),
  current_amount numeric(14, 2) not null default 0 check (current_amount >= 0),
  target_date date,
  owner_scope public.goal_owner_scope not null default 'household',
  created_at timestamptz not null default now()
);

create table public.decision_notes (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  month text not null check (month ~ '^\d{4}-\d{2}$'),
  body text not null,
  created_at timestamptz not null default now(),
  unique (household_id, month)
);

-- RLS
alter table public.profiles enable row level security;
alter table public.households enable row level security;
alter table public.household_members enable row level security;
alter table public.household_invites enable row level security;
alter table public.categories enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;
alter table public.recurring_expense_templates enable row level security;
alter table public.goals enable row level security;
alter table public.decision_notes enable row level security;

-- Helper: user is member of household
create or replace function public.is_household_member (_household_id uuid, _uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.household_members hm
    where hm.household_id = _household_id
      and hm.user_id = _uid
  );
$$;

-- Profiles: own row
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());
create policy profiles_insert_own on public.profiles
  for insert with check (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid());

-- Households
create policy households_select on public.households
  for select using (public.is_household_member (id, auth.uid()));
create policy households_insert on public.households
  for insert with check (auth.uid () is not null);
create policy households_update on public.households
  for update using (public.is_household_member (id, auth.uid()));

-- Members
create policy hm_select on public.household_members
  for select using (public.is_household_member (household_id, auth.uid()));
create policy hm_insert on public.household_members
  for insert with check (
    user_id = auth.uid()
    or public.is_household_member (household_id, auth.uid())
  );
create policy hm_update on public.household_members
  for update using (public.is_household_member (household_id, auth.uid()));

-- Invites (token redemption via accept_household_invite RPC)
create policy invites_select on public.household_invites
  for select using (public.is_household_member (household_id, auth.uid ()));
create policy invites_insert on public.household_invites
  for insert with check (public.is_household_member (household_id, auth.uid ()));
create policy invites_delete on public.household_invites
  for delete using (public.is_household_member (household_id, auth.uid ()));

-- Categories
create policy cat_all on public.categories
  for all using (public.is_household_member (household_id, auth.uid()))
  with check (public.is_household_member (household_id, auth.uid()));

-- Expenses
create policy exp_all on public.expenses
  for all using (public.is_household_member (household_id, auth.uid()))
  with check (public.is_household_member (household_id, auth.uid()));

-- Splits
create policy es_all on public.expense_splits
  for all using (
    exists (
      select 1
      from public.expenses e
      where e.id = expense_id
        and public.is_household_member (e.household_id, auth.uid())
    )
  )
  with check (
    exists (
      select 1
      from public.expenses e
      where e.id = expense_id
        and public.is_household_member (e.household_id, auth.uid())
    )
  );

-- Settlements
create policy st_all on public.settlements
  for all using (public.is_household_member (household_id, auth.uid()))
  with check (public.is_household_member (household_id, auth.uid()));

-- Recurring
create policy rec_all on public.recurring_expense_templates
  for all using (public.is_household_member (household_id, auth.uid()))
  with check (public.is_household_member (household_id, auth.uid()));

-- Goals
create policy goals_all on public.goals
  for all using (public.is_household_member (household_id, auth.uid()))
  with check (public.is_household_member (household_id, auth.uid()));

-- Decision notes
create policy dn_all on public.decision_notes
  for all using (public.is_household_member (household_id, auth.uid()))
  with check (public.is_household_member (household_id, auth.uid()));

-- Trigger: new user profile
create or replace function public.handle_new_user ()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'display_name',
      case
        when new.email is not null then split_part(new.email, '@', 1)
        else 'user'
      end
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user ();

-- RPC: recompute splits for one expense (R-05)
create or replace function public.recalculate_expense_splits (_expense_id uuid)
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  e record;
  members uuid[];
  m_count int;
  i int;
  p_first numeric;
  p_second numeric;
  inc_a numeric;
  inc_b numeric;
  total_inc numeric;
  share numeric;
  a1 numeric;
  a2 numeric;
begin
  select * into e from public.expenses where id = _expense_id;
  if e is null then
    raise exception 'expense not found';
  end if;

  delete from public.expense_splits where expense_id = _expense_id;

  if e.expense_type = 'personal' then
    insert into public.expense_splits (expense_id, member_id, percent, amount_due)
    values (_expense_id, e.payer_member_id, 100, e.amount);
    return;
  end if;

  select array_agg(id order by created_at)
  into members
  from public.household_members
  where household_id = e.household_id;

  m_count := coalesce(array_length(members, 1), 0);
  if m_count < 1 then
    raise exception 'no members';
  end if;

  if m_count = 1 then
    insert into public.expense_splits (expense_id, member_id, percent, amount_due)
    values (_expense_id, members[1], 100, e.amount);
    return;
  end if;

  -- Two or more: MVP targets couple — use first two ordered for 2-person split math
  case e.split_rule_snapshot
    when 'equal' then
      declare
        total_cents int := round(e.amount * 100);
        base int := total_cents / m_count;
        rem int := total_cents % m_count;
        amt numeric;
      begin
        for i in 1..m_count loop
          amt := (base + case when i <= rem then 1 else 0 end) / 100.0;
          insert into public.expense_splits (expense_id, member_id, percent, amount_due)
          values (
            _expense_id,
            members[i],
            100.0 / m_count,
            amt
          );
        end loop;
      end;
    when 'custom_percent' then
      p_first := coalesce(e.split_custom_percent_snapshot, 50);
      p_second := 100 - p_first;
      a1 := round(e.amount * p_first / 100, 2);
      a2 := e.amount - a1;
      insert into public.expense_splits (expense_id, member_id, percent, amount_due)
      values
        (_expense_id, members[1], p_first, a1),
        (_expense_id, members[2], p_second, a2);
      if m_count > 2 then
        for i in 3..m_count loop
          insert into public.expense_splits (expense_id, member_id, percent, amount_due)
          values (_expense_id, members[i], 0, 0);
        end loop;
      end if;
    when 'proportional_income' then
      select monthly_income into inc_a from public.household_members where id = members[1];
      select monthly_income into inc_b from public.household_members where id = members[2];
      total_inc := coalesce(inc_a, 0) + coalesce(inc_b, 0);
      if total_inc <= 0 then
        share := e.amount / 2;
        a1 := round(share, 2);
        a2 := e.amount - a1;
        insert into public.expense_splits (expense_id, member_id, percent, amount_due)
        values
          (_expense_id, members[1], 50, a1),
          (_expense_id, members[2], 50, a2);
      else
        p_first := round(100.0 * coalesce(inc_a, 0) / total_inc, 4);
        p_second := 100 - p_first;
        a1 := round(e.amount * coalesce(inc_a, 0) / total_inc, 2);
        a2 := e.amount - a1;
        insert into public.expense_splits (expense_id, member_id, percent, amount_due)
        values
          (_expense_id, members[1], p_first, a1),
          (_expense_id, members[2], p_second, a2);
      end if;
      if m_count > 2 then
        for i in 3..m_count loop
          insert into public.expense_splits (expense_id, member_id, percent, amount_due)
          values (_expense_id, members[i], 0, 0);
        end loop;
      end if;
  end case;
end;
$$;

grant execute on function public.recalculate_expense_splits (uuid) to authenticated;

create or replace function public.trigger_recalc_expense_splits ()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.recalculate_expense_splits (new.id);
  return new;
end;
$$;

create trigger expenses_recalc_splits
after insert
or
update of amount,
payer_member_id,
expense_type,
split_rule_snapshot,
split_custom_percent_snapshot on public.expenses for each row
execute procedure public.trigger_recalc_expense_splits ();

create or replace function public.accept_household_invite (_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  inv public.household_invites%rowtype;
begin
  if auth.uid () is null then
    raise exception 'not authenticated';
  end if;

  select * into inv
  from public.household_invites
  where token = _token
    and expires_at > now ();

  if inv.id is null then
    raise exception 'invalid or expired invite';
  end if;

  insert into public.household_members (household_id, user_id, role)
  values (inv.household_id, auth.uid (), 'member')
  on conflict (household_id, user_id) do nothing;

  delete from public.household_invites where id = inv.id;

  return inv.household_id;
end;
$$;

grant execute on function public.accept_household_invite (text) to authenticated;
