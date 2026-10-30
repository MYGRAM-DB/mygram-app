BEGIN;

CREATE TABLE public.ui_translation_cache (
  source_locale text NOT NULL DEFAULT 'ar',
  target_locale text NOT NULL,
  translation_key text NOT NULL,
  source_text text NOT NULL,
  translated_text text NOT NULL,
  provider text NOT NULL DEFAULT 'mymemory',
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_locale, target_locale, translation_key)
);

CREATE TABLE public.ui_translation_daily_usage (
  usage_date date PRIMARY KEY DEFAULT current_date,
  characters_used integer NOT NULL DEFAULT 0 CHECK (characters_used BETWEEN 0 AND 4500),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ui_translation_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ui_translation_cache FORCE ROW LEVEL SECURITY;
ALTER TABLE public.ui_translation_daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ui_translation_daily_usage FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.ui_translation_cache, public.ui_translation_daily_usage
FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ui_translation_cache TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ui_translation_daily_usage TO service_role;

CREATE OR REPLACE FUNCTION public.reserve_mygram_translation_quota(p_characters integer)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  affected integer;
BEGIN
  IF p_characters IS NULL OR p_characters < 1 OR p_characters > 4500 THEN
    RETURN false;
  END IF;

  INSERT INTO public.ui_translation_daily_usage (usage_date, characters_used)
  VALUES (current_date, p_characters)
  ON CONFLICT (usage_date) DO UPDATE
    SET characters_used = public.ui_translation_daily_usage.characters_used + EXCLUDED.characters_used,
        updated_at = now()
    WHERE public.ui_translation_daily_usage.characters_used + EXCLUDED.characters_used <= 4500;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected = 1;
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_mygram_translation_quota(integer)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_mygram_translation_quota(integer)
TO service_role;

COMMENT ON TABLE public.ui_translation_cache IS
  'Cached machine translations for MYGRAM static UI strings only. Never store user messages, profile data or personal content here.';
COMMENT ON TABLE public.ui_translation_daily_usage IS
  'Global daily quota counter for free MyMemory UI translation calls, capped below the anonymous daily limit.';
COMMENT ON FUNCTION public.reserve_mygram_translation_quota(integer) IS
  'Atomically reserves characters against a conservative 4500-character daily free-provider budget. Service-role only.';

COMMIT;
