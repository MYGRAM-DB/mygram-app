-- Add optional, user-controlled discovery metadata without collecting precise location.
-- Safe additive migration: no existing rows or tables are deleted.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_language text NOT NULL DEFAULT 'ar',
  ADD COLUMN IF NOT EXISTS country_code char(2),
  ADD COLUMN IF NOT EXISTS nationality_code char(2),
  ADD COLUMN IF NOT EXISTS region text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS interests text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS discovery_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_preferred_language_format,
  ADD CONSTRAINT profiles_preferred_language_format
    CHECK (preferred_language ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  DROP CONSTRAINT IF EXISTS profiles_country_code_format,
  ADD CONSTRAINT profiles_country_code_format
    CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  DROP CONSTRAINT IF EXISTS profiles_nationality_code_format,
  ADD CONSTRAINT profiles_nationality_code_format
    CHECK (nationality_code IS NULL OR nationality_code ~ '^[A-Z]{2}$'),
  DROP CONSTRAINT IF EXISTS profiles_interests_limit,
  ADD CONSTRAINT profiles_interests_limit
    CHECK (cardinality(interests) <= 30);

-- Discovery fields are optional. Do not add latitude/longitude or infer precise
-- location from IP; city/region discovery must remain an explicit user choice.
CREATE INDEX IF NOT EXISTS profiles_country_discovery_idx
  ON public.profiles (country_code, discovery_enabled)
  WHERE discovery_enabled = true;
CREATE INDEX IF NOT EXISTS profiles_language_idx
  ON public.profiles (preferred_language);
