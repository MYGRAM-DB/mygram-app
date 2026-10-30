BEGIN;

-- Profile/onboarding fields present in Production but missing from Staging.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS profile_completed boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS study_place text,
  ADD COLUMN IF NOT EXISTS work_place text,
  ADD COLUMN IF NOT EXISTS public_nationality_code text,
  ADD COLUMN IF NOT EXISTS public_living_country_code text,
  ADD COLUMN IF NOT EXISTS public_living_region text,
  ADD COLUMN IF NOT EXISTS public_living_city text,
  ADD COLUMN IF NOT EXISTS show_living_location boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.profiles'::regclass
      AND conname = 'profiles_username_key'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_username_key UNIQUE (username);
  END IF;
END
$$;

-- Preference controls and provenance fields used by Production.
ALTER TABLE public.user_preferences
  ADD COLUMN IF NOT EXISTS auto_detect_language boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_detect_region boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS timezone_name text,
  ADD COLUMN IF NOT EXISTS country_detection_source text,
  ADD COLUMN IF NOT EXISTS language_detection_source text,
  ADD COLUMN IF NOT EXISTS location_consent_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_preferences'::regclass AND conname = 'user_preferences_city_name_check') THEN
    ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_city_name_check
      CHECK (city_name IS NULL OR (char_length(btrim(city_name)) >= 1 AND char_length(btrim(city_name)) <= 100));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_preferences'::regclass AND conname = 'user_preferences_country_detection_source_check') THEN
    ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_country_detection_source_check
      CHECK (country_detection_source IS NULL OR country_detection_source = ANY (ARRAY['manual','browser_locale','ip_approximate','gps_consent']));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_preferences'::regclass AND conname = 'user_preferences_current_country_code_check') THEN
    ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_current_country_code_check
      CHECK (current_country_code IS NULL OR current_country_code ~ '^[A-Z]{2}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_preferences'::regclass AND conname = 'user_preferences_language_code_check') THEN
    ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_language_code_check
      CHECK (language_code ~ '^[a-z]{2}(-[A-Z]{2})?$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_preferences'::regclass AND conname = 'user_preferences_language_detection_source_check') THEN
    ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_language_detection_source_check
      CHECK (language_detection_source IS NULL OR language_detection_source = ANY (ARRAY['manual','browser_locale','account_default']));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_preferences'::regclass AND conname = 'user_preferences_nationality_code_check') THEN
    ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_nationality_code_check
      CHECK (nationality_code IS NULL OR nationality_code ~ '^[A-Z]{2}$');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.user_preferences'::regclass AND conname = 'user_preferences_region_check') THEN
    ALTER TABLE public.user_preferences ADD CONSTRAINT user_preferences_region_check
      CHECK (region IS NULL OR (char_length(btrim(region)) >= 1 AND char_length(btrim(region)) <= 100));
  END IF;
END
$$;

-- Keep Staging-only columns (english_name/is_active/sort_order) while
-- exposing the Production column names expected by the rebuilt application.
ALTER TABLE public.supported_locales
  ADD COLUMN IF NOT EXISTS enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

UPDATE public.supported_locales
SET enabled = is_active;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.supported_locales'::regclass AND conname = 'supported_locales_native_name_check') THEN
    ALTER TABLE public.supported_locales ADD CONSTRAINT supported_locales_native_name_check
      CHECK (char_length(btrim(native_name)) >= 1 AND char_length(btrim(native_name)) <= 80);
  END IF;
END
$$;

-- Match Production text limits while retaining Staging's additional media check.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.posts'::regclass AND conname = 'posts_content_check') THEN
    ALTER TABLE public.posts ADD CONSTRAINT posts_content_check
      CHECK (char_length(btrim(content)) <= 5000);
  END IF;
END
$$;

-- Add nested-comment support and widen the limit to the Production contract.
ALTER TABLE public.post_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid;

ALTER TABLE public.post_comments
  DROP CONSTRAINT IF EXISTS post_comments_content_check;

ALTER TABLE public.post_comments
  ADD CONSTRAINT post_comments_content_check
  CHECK (char_length(btrim(content)) >= 1 AND char_length(btrim(content)) <= 2000);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.post_comments'::regclass AND conname = 'post_comments_parent_comment_id_fkey') THEN
    ALTER TABLE public.post_comments
      ADD CONSTRAINT post_comments_parent_comment_id_fkey
      FOREIGN KEY (parent_comment_id) REFERENCES public.post_comments(id) ON DELETE CASCADE;
  END IF;
END
$$;

-- Cover existing FK lookups flagged by the Staging performance advisor,
-- plus the new self-referencing comments FK.
CREATE INDEX IF NOT EXISTS post_comments_parent_comment_id_idx
  ON public.post_comments(parent_comment_id);
CREATE INDEX IF NOT EXISTS post_comments_user_id_idx
  ON public.post_comments(user_id);
CREATE INDEX IF NOT EXISTS post_reactions_user_id_idx
  ON public.post_reactions(user_id);

COMMIT;
