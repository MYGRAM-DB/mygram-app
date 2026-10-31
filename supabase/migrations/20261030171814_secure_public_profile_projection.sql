BEGIN;

-- Keep the base profile table inaccessible through the authenticated Data API.
REVOKE ALL ON TABLE public.profiles FROM PUBLIC, anon, authenticated;

-- Public-facing projection. Sensitive study/work values and the internal
-- profile-completion flag are intentionally excluded. Living-location
-- fields are returned only when the owner opted in.
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_barrier = true)
AS
SELECT
  p.id,
  p.full_name,
  p.username,
  p.first_name,
  p.last_name,
  p.bio,
  p.avatar_url,
  p.cover_url,
  p.interests,
  p.created_at,
  p.updated_at,
  p.public_nationality_code AS nationality_code,
  CASE WHEN p.show_living_location THEN p.public_living_country_code ELSE NULL END AS living_country_code,
  CASE WHEN p.show_living_location THEN p.public_living_region ELSE NULL END AS living_region,
  CASE WHEN p.show_living_location THEN p.public_living_city ELSE NULL END AS living_city
FROM public.profiles AS p;

-- A caller can only read their own onboarding completion state.
CREATE OR REPLACE VIEW public.my_profile_state
WITH (security_barrier = true)
AS
SELECT p.id, p.profile_completed
FROM public.profiles AS p
WHERE p.id = (SELECT auth.uid());

REVOKE ALL ON public.public_profiles FROM PUBLIC, anon, authenticated;
REVOKE ALL ON public.my_profile_state FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.my_profile_state TO authenticated;

COMMENT ON VIEW public.public_profiles IS
  'Safe public profile projection. Study/work fields and internal completion flags are excluded; living location is null unless the profile owner opted in.';
COMMENT ON VIEW public.my_profile_state IS
  'Current authenticated user profile completion state only.';

-- Tighten the base-table RLS policy as defence in depth in case a future
-- migration accidentally grants direct SELECT again.
DROP POLICY IF EXISTS profiles_select_authenticated ON public.profiles;
CREATE POLICY profiles_select_own_only
ON public.profiles
FOR SELECT TO authenticated
USING (id = (SELECT auth.uid()));

COMMIT;
