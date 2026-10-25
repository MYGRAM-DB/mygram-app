create table if not exists public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  language_code text not null default 'ar' check (language_code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  current_country_code text check (current_country_code is null or current_country_code ~ '^[A-Z]{2}$'),
  nationality_code text check (nationality_code is null or nationality_code ~ '^[A-Z]{2}$'),
  city_name text check (city_name is null or char_length(btrim(city_name)) between 1 and 100),
  share_location boolean not null default false,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;

drop policy if exists user_preferences_select_own on public.user_preferences;
create policy user_preferences_select_own
on public.user_preferences for select to authenticated
using (user_id = (select auth.uid()));

drop policy if exists user_preferences_insert_own on public.user_preferences;
create policy user_preferences_insert_own
on public.user_preferences for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists user_preferences_update_own on public.user_preferences;
create policy user_preferences_update_own
on public.user_preferences for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

drop policy if exists user_preferences_delete_own on public.user_preferences;
create policy user_preferences_delete_own
on public.user_preferences for delete to authenticated
using (user_id = (select auth.uid()));

create index if not exists user_preferences_local_lookup_idx
on public.user_preferences (current_country_code, lower(city_name))
where share_location = true;

create or replace function public.recommend_mygram_profiles(match_limit integer default 20)
returns table (
  id uuid,
  username text,
  full_name text,
  avatar_url text,
  shared_interests text[],
  match_reason text
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select p.id, p.interests, pref.current_country_code, pref.city_name, pref.share_location
    from public.profiles p
    left join public.user_preferences pref on pref.user_id = p.id
    where p.id = auth.uid()
  ),
  candidates as (
    select
      p.id,
      p.username,
      p.full_name,
      p.avatar_url,
      coalesce(array(
        select unnest(coalesce(p.interests, '{}'::text[]))
        intersect
        select unnest(coalesce(me.interests, '{}'::text[]))
      ), '{}'::text[]) as common_interests,
      (
        me.share_location and pref.share_location
        and me.current_country_code is not null
        and me.current_country_code = pref.current_country_code
        and me.city_name is not null
        and lower(me.city_name) = lower(pref.city_name)
      ) as same_city,
      (
        me.share_location and pref.share_location
        and me.current_country_code is not null
        and me.current_country_code = pref.current_country_code
      ) as same_country
    from public.profiles p
    join public.user_preferences pref on pref.user_id = p.id
    cross join me
    where p.id <> auth.uid()
  )
  select
    c.id, c.username, c.full_name, c.avatar_url, c.common_interests,
    case
      when c.same_city then 'same_city'
      when c.same_country then 'same_country'
      else 'shared_interests'
    end as match_reason
  from candidates c
  where c.same_city or c.same_country or cardinality(c.common_interests) > 0
  order by c.same_city desc, c.same_country desc, cardinality(c.common_interests) desc, c.full_name
  limit greatest(1, least(coalesce(match_limit, 20), 50));
$$;

revoke all on function public.recommend_mygram_profiles(integer) from public, anon;
grant execute on function public.recommend_mygram_profiles(integer) to authenticated;
