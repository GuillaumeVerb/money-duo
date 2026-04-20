-- Si la 600 avait déjà été appliquée avec _default_split_rule en enum, PostgREST ne matche pas le client.
drop function if exists public.bootstrap_new_household(text, text, public.split_rule_kind, numeric, text[], text, timestamptz);

create or replace function public.bootstrap_new_household (
  _name text,
  _currency text,
  _default_split_rule text,
  _default_custom_percent numeric,
  _category_names text[],
  _invite_token text,
  _invite_expires_at timestamptz
)
returns table (
  household_id uuid,
  invite_token text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  _uid uuid := auth.uid();
  _hid uuid;
  _cname text;
  _cats text[];
  _rule public.split_rule_kind;
begin
  if _uid is null then
    raise exception 'not authenticated';
  end if;

  if _name is null or length(trim(_name)) = 0 then
    raise exception 'name required';
  end if;

  if _invite_token is null or length(trim(_invite_token)) = 0 then
    raise exception 'invite token required';
  end if;

  if _default_split_rule is null
    or trim(_default_split_rule) not in ('equal', 'custom_percent', 'proportional_income')
  then
    raise exception 'invalid split rule: %', _default_split_rule;
  end if;

  _rule := trim(_default_split_rule)::public.split_rule_kind;
  _cats := coalesce(_category_names, '{}');

  insert into public.households (name, currency, default_split_rule, default_custom_percent)
  values (
    trim(_name),
    nullif(trim(coalesce(_currency, 'EUR')), ''),
    _rule,
    _default_custom_percent
  )
  returning id into _hid;

  insert into public.household_members (household_id, user_id, role)
  values (_hid, _uid, 'owner');

  foreach _cname in array _cats
  loop
    if _cname is not null and length(trim(_cname)) > 0 then
      insert into public.categories (household_id, name)
      values (_hid, trim(_cname));
    end if;
  end loop;

  insert into public.household_invites (household_id, token, invited_by, expires_at)
  values (_hid, trim(_invite_token), _uid, _invite_expires_at);

  return query select _hid, trim(_invite_token);
end;
$$;

revoke all on function public.bootstrap_new_household (
  text,
  text,
  text,
  numeric,
  text[],
  text,
  timestamptz
) from public;

grant execute on function public.bootstrap_new_household (
  text,
  text,
  text,
  numeric,
  text[],
  text,
  timestamptz
) to authenticated;
