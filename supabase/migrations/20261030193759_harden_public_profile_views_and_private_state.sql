BEGIN;

-- Public profiles must execute with the caller's permissions and obey RLS.
ALTER VIEW public.public_profiles SET (security_invoker = true);

-- Only columns intentionally exposed by public_profiles are queryable from
-- authenticated sessions. Private study/work fields and completion state
-- remain unavailable through the base table.
GRANT SELECT (
  id,
  full_name,
  username,
  first_name,
  last_name,
  bio,
  avatar_url,
  cover_url,
  interests,
  created_at,
  updated_at,
  public_nationality_code,
  public_living_country_code,
  public_living_region,
  public_living_city,
  show_living_location
) ON public.profiles TO authenticated;

DROP POLICY IF EXISTS profiles_select_own_only ON public.profiles;
DROP POLICY IF EXISTS profiles_select_public_projection ON public.profiles;
CREATE POLICY profiles_select_public_projection
ON public.profiles
FOR SELECT TO authenticated
USING (true);

-- The previous view exposed profile completion state. Replace it with a
-- narrow caller-identity-bound RPC so profile_completed is never granted
-- as a selectable base-table column.
DROP VIEW IF EXISTS public.my_profile_state;

CREATE OR REPLACE FUNCTION mygram_private.current_profile_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $function$
  SELECT jsonb_build_object(
    'id', p.id,
    'profile_completed', p.profile_completed
  )
  FROM public.profiles AS p
  WHERE p.id = (SELECT auth.uid());
$function$;

REVOKE ALL ON FUNCTION mygram_private.current_profile_state()
FROM PUBLIC, anon, authenticated;
GRANT USAGE ON SCHEMA mygram_private TO authenticated;
GRANT EXECUTE ON FUNCTION mygram_private.current_profile_state()
TO authenticated;

CREATE OR REPLACE FUNCTION public.get_my_profile_state()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $function$
  SELECT mygram_private.current_profile_state();
$function$;

REVOKE ALL ON FUNCTION public.get_my_profile_state()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_profile_state()
TO authenticated;

COMMENT ON FUNCTION public.get_my_profile_state() IS
  'Returns only the current authenticated user profile completion state.';

COMMIT;
