-- Remove the unused legacy password-hash field from the public profile table.
-- Supabase Auth owns credential storage; this column is not referenced by the app and contained no data.
ALTER TABLE public.users DROP COLUMN IF EXISTS password_hash;
