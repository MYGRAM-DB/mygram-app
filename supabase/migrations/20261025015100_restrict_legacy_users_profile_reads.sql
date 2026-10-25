-- The legacy users table contains account email addresses and is not used by the current app for discovery.
-- Remove the broad read policy; authenticated members may still read their own legacy row through the own-profile policy.
DROP POLICY IF EXISTS "MYGRAM members can view profiles" ON public.users;
