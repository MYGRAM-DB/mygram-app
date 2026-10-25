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
        me.share_location and coalesce(pref.share_location, false)
        and me.current_country_code is not null
        and me.current_country_code = pref.current_country_code
        and me.city_name is not null
        and lower(me.city_name) = lower(pref.city_name)
      ) as same_city,
      (
        me.share_location and coalesce(pref.share_location, false)
        and me.current_country_code is not null
        and me.current_country_code = pref.current_country_code
      ) as same_country
    from public.profiles p
    left join public.user_preferences pref on pref.user_id = p.id
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
  where coalesce(c.same_city, false) or coalesce(c.same_country, false) or cardinality(c.common_interests) > 0
  order by c.same_city desc nulls last, c.same_country desc nulls last, cardinality(c.common_interests) desc, c.full_name
  limit greatest(1, least(coalesce(match_limit, 20), 50));
$$;

revoke all on function public.recommend_mygram_profiles(integer) from public, anon;
grant execute on function public.recommend_mygram_profiles(integer) to authenticated;
