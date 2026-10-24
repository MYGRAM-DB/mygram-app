-- The auth trigger calls this function internally. It must not be callable as a public RPC.
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
