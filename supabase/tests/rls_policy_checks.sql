-- Run against the Staging database after migrations.
-- These assertions validate RLS/policy/grant configuration without creating user data.
do $$
declare
  t text;
  missing_count integer;
  bad_policy_count integer;
begin
  select count(*) into missing_count
  from (values ('profiles'),('user_preferences'),('posts'),('post_comments'),('post_reactions')) expected(table_name)
  where not exists (
    select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=expected.table_name and c.relkind='r' and c.relrowsecurity
  );
  if missing_count <> 0 then
    raise exception 'RLS is not enabled on % expected public tables', missing_count;
  end if;

  if exists (
    select 1 from information_schema.role_table_grants
    where table_schema='public' and table_name in ('profiles','user_preferences','posts','post_comments','post_reactions')
      and grantee='anon'
  ) then
    raise exception 'anon has table privileges on a protected MYGRAM table';
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='profiles'
      and policyname='profiles_update_self'
      and qual like '%auth.uid()%id%'
      and with_check like '%auth.uid()%id%'
  ) then
    raise exception 'profiles update policy is missing its ownership USING/WITH CHECK guards';
  end if;

  select count(*) into bad_policy_count
  from (values
    ('user_preferences','user_preferences_select_self','SELECT'),
    ('user_preferences','user_preferences_insert_self','INSERT'),
    ('user_preferences','user_preferences_update_self','UPDATE'),
    ('user_preferences','user_preferences_delete_self','DELETE'),
    ('posts','posts_insert_self','INSERT'),
    ('posts','posts_update_self','UPDATE'),
    ('posts','posts_delete_self','DELETE'),
    ('post_comments','post_comments_insert_self','INSERT'),
    ('post_comments','post_comments_update_self','UPDATE'),
    ('post_comments','post_comments_delete_self','DELETE'),
    ('post_reactions','post_reactions_insert_self','INSERT'),
    ('post_reactions','post_reactions_update_self','UPDATE'),
    ('post_reactions','post_reactions_delete_self','DELETE')
  ) expected(table_name, policy_name, command)
  where not exists (
    select 1 from pg_policies p
    where p.schemaname='public'
      and p.tablename=expected.table_name
      and p.policyname=expected.policy_name
      and p.cmd=expected.command
      and (
        coalesce(p.qual,'') like '%auth.uid()%'
        or coalesce(p.with_check,'') like '%auth.uid()%'
      )
  );
  if bad_policy_count <> 0 then
    raise exception '% owner-scoped policies missing or do not reference auth.uid()', bad_policy_count;
  end if;

  if not exists (
    select 1 from pg_trigger tr
    join pg_class c on c.oid=tr.tgrelid
    join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='auth' and c.relname='users'
      and tr.tgname='on_auth_user_created' and not tr.tgisinternal
  ) then
    raise exception 'Expected auth.users profile trigger is missing';
  end if;
end $$;

select 'PASS: staging RLS metadata, owner policies, anon grants, and auth trigger checks' as test_result;
