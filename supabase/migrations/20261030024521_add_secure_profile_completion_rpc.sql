BEGIN;

CREATE OR REPLACE FUNCTION public.complete_mygram_profile(
  p_first_name text,
  p_last_name text,
  p_username text,
  p_date_of_birth date,
  p_gender text DEFAULT NULL,
  p_nationality_code text DEFAULT NULL,
  p_contact_phone text DEFAULT NULL,
  p_current_country_code text DEFAULT NULL,
  p_region text DEFAULT NULL,
  p_city_name text DEFAULT NULL,
  p_bio text DEFAULT '',
  p_interests text[] DEFAULT ARRAY[]::text[],
  p_share_location boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_user_id uuid := auth.uid();
  v_email text;
  v_first_name text := pg_catalog.btrim(coalesce(p_first_name, ''));
  v_last_name text := pg_catalog.btrim(coalesce(p_last_name, ''));
  v_username text := pg_catalog.lower(pg_catalog.btrim(coalesce(p_username, '')));
  v_nationality text := nullif(pg_catalog.upper(pg_catalog.btrim(coalesce(p_nationality_code, ''))), '');
  v_country text := nullif(pg_catalog.upper(pg_catalog.btrim(coalesce(p_current_country_code, ''))), '');
  v_gender text := nullif(pg_catalog.btrim(coalesce(p_gender, '')), '');
  v_phone text := nullif(pg_catalog.btrim(coalesce(p_contact_phone, '')), '');
  v_region text := nullif(pg_catalog.btrim(coalesce(p_region, '')), '');
  v_city text := nullif(pg_catalog.btrim(coalesce(p_city_name, '')), '');
  v_bio text := pg_catalog.btrim(coalesce(p_bio, ''));
  v_interests text[] := ARRAY[]::text[];
  v_full_name text;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='AUTHENTICATION_REQUIRED';
  END IF;

  IF pg_catalog.char_length(v_first_name) < 1 OR pg_catalog.char_length(v_first_name) > 60
     OR pg_catalog.char_length(v_last_name) < 1 OR pg_catalog.char_length(v_last_name) > 60 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='INVALID_NAME';
  END IF;

  IF v_username !~ '^[a-z0-9_]{3,30}$' THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='INVALID_USERNAME';
  END IF;

  IF p_date_of_birth IS NULL OR p_date_of_birth > CURRENT_DATE THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='INVALID_DATE_OF_BIRTH';
  END IF;

  IF v_gender IS NOT NULL AND v_gender <> ALL (ARRAY['female','male','nonbinary','prefer_not_to_say']) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='INVALID_GENDER';
  END IF;

  IF v_bio IS NOT NULL AND pg_catalog.char_length(v_bio) > 500 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='BIO_TOO_LONG';
  END IF;

  IF v_phone IS NOT NULL AND (pg_catalog.char_length(v_phone) > 30 OR v_phone !~ '^[+0-9() .-]{7,30}$') THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='INVALID_CONTACT_PHONE';
  END IF;

  IF v_region IS NOT NULL AND pg_catalog.char_length(v_region) > 100 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='REGION_TOO_LONG';
  END IF;
  IF v_city IS NOT NULL AND pg_catalog.char_length(v_city) > 100 THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='CITY_TOO_LONG';
  END IF;

  IF v_nationality IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.supported_countries c WHERE c.code=v_nationality AND c.enabled=true
  ) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='INVALID_NATIONALITY_CODE';
  END IF;

  IF v_country IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.supported_countries c WHERE c.code=v_country AND c.enabled=true
  ) THEN
    RAISE EXCEPTION USING ERRCODE='22023', MESSAGE='INVALID_CURRENT_COUNTRY_CODE';
  END IF;

  SELECT pg_catalog.array_agg(cleaned_interest)
  INTO v_interests
  FROM (
    SELECT pg_catalog.btrim(raw_interest) AS cleaned_interest
    FROM pg_catalog.unnest(coalesce(p_interests, ARRAY[]::text[])) AS interests(raw_interest)
    WHERE pg_catalog.char_length(pg_catalog.btrim(raw_interest)) BETWEEN 1 AND 50
    LIMIT 20
  ) AS normalized_interests;

  v_interests := coalesce(v_interests, ARRAY[]::text[]);
  v_full_name := v_first_name || ' ' || v_last_name;

  SELECT u.email INTO v_email
  FROM auth.users AS u
  WHERE u.id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE='42501', MESSAGE='AUTH_USER_NOT_FOUND';
  END IF;

  -- The case-insensitive unique index on lower(username) is the final
  -- concurrency-safe guard; this pre-check returns a clearer error.
  IF EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE pg_catalog.lower(p.username)=v_username AND p.id<>v_user_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE='23505', MESSAGE='USERNAME_TAKEN';
  END IF;

  BEGIN
    INSERT INTO public.profiles
      (id,first_name,last_name,full_name,username,bio,interests,profile_completed,updated_at)
    VALUES
      (v_user_id,v_first_name,v_last_name,v_full_name,v_username,v_bio,v_interests,true,pg_catalog.now())
    ON CONFLICT (id) DO UPDATE SET
      first_name=EXCLUDED.first_name,
      last_name=EXCLUDED.last_name,
      full_name=EXCLUDED.full_name,
      username=EXCLUDED.username,
      bio=EXCLUDED.bio,
      interests=EXCLUDED.interests,
      profile_completed=true,
      updated_at=pg_catalog.now();
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION USING ERRCODE='23505', MESSAGE='USERNAME_TAKEN';
  END;

  INSERT INTO public.profile_private_details
    (user_id,date_of_birth,gender,nationality_code,contact_email,contact_phone)
  VALUES
    (v_user_id,p_date_of_birth,v_gender,v_nationality,v_email,v_phone)
  ON CONFLICT (user_id) DO UPDATE SET
    date_of_birth=EXCLUDED.date_of_birth,
    gender=EXCLUDED.gender,
    nationality_code=EXCLUDED.nationality_code,
    contact_email=EXCLUDED.contact_email,
    contact_phone=EXCLUDED.contact_phone,
    updated_at=pg_catalog.now();

  INSERT INTO public.user_preferences
    (user_id,current_country_code,nationality_code,region,city_name,share_location,location_consent_at,country_detection_source,updated_at)
  VALUES
    (v_user_id,v_country,v_nationality,v_region,v_city,coalesce(p_share_location,false),
     CASE WHEN coalesce(p_share_location,false) THEN pg_catalog.now() ELSE NULL END,
     CASE WHEN v_country IS NULL THEN NULL ELSE 'manual' END,pg_catalog.now())
  ON CONFLICT (user_id) DO UPDATE SET
    current_country_code=EXCLUDED.current_country_code,
    nationality_code=EXCLUDED.nationality_code,
    region=EXCLUDED.region,
    city_name=EXCLUDED.city_name,
    share_location=EXCLUDED.share_location,
    location_consent_at=EXCLUDED.location_consent_at,
    country_detection_source=EXCLUDED.country_detection_source,
    updated_at=pg_catalog.now();

  RETURN pg_catalog.jsonb_build_object(
    'profile_completed',true,
    'username',v_username
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.complete_mygram_profile(
  text,text,text,date,text,text,text,text,text,text,text,text[],boolean
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.complete_mygram_profile(
  text,text,text,date,text,text,text,text,text,text,text,text[],boolean
) TO authenticated;

COMMENT ON FUNCTION public.complete_mygram_profile(
  text,text,text,date,text,text,text,text,text,text,text,text[],boolean
) IS 'Atomically completes the caller profile, private identity details and private preferences. User identity is always derived from auth.uid().';

COMMIT;
