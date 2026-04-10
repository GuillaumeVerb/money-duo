-- Suppression des données foyer + profil applicatif pour l'utilisateur courant.
-- Ne supprime pas la ligne auth.users (compte e-mail) : à traiter via le dashboard
-- Supabase, une Edge Function (service role), ou une demande support.

create or replace function public.purge_my_account_household_data ()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid ();
  hid uuid;
  my_mid uuid;
  m_count int;
  keeper uuid;
  exp_rec record;
begin
  if uid is null then
    raise exception 'not authenticated';
  end if;

  while exists (select 1 from public.household_members where user_id = uid) loop
    select household_id, id
    into hid, my_mid
    from public.household_members
    where user_id = uid
    limit 1;

    select count(*)::int
    into m_count
    from public.household_members
    where household_id = hid;

    if m_count <= 1 then
      delete from public.households where id = hid;
    else
      select hm2.id
      into keeper
      from public.household_members hm2
      where hm2.household_id = hid
        and hm2.user_id <> uid
      order by hm2.created_at asc
      limit 1;

      if keeper is null then
        raise exception 'internal: no other member in household';
      end if;

      update public.expenses
      set payer_member_id = keeper
      where household_id = hid
        and payer_member_id = my_mid;

      delete from public.settlements
      where household_id = hid
        and (
          from_member_id = my_mid
          or to_member_id = my_mid
        );

      update public.recurring_expense_templates
      set payer_member_id = keeper
      where household_id = hid
        and payer_member_id = my_mid;

      delete from public.household_members where id = my_mid;

      for exp_rec in
        select id from public.expenses where household_id = hid
      loop
        perform public.recalculate_expense_splits (exp_rec.id);
      end loop;
    end if;
  end loop;

  delete from public.profiles where id = uid;

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.purge_my_account_household_data () is
  'Efface foyers solo, retire le membre des foyers partagés (réassigne payeur, supprime règlements impliquant ce membre, recalcule les splits), puis supprime le profil applicatif.';

grant execute on function public.purge_my_account_household_data () to authenticated;
