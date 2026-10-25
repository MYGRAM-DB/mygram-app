-- Prevent duplicate requests in either direction and disallow requesting yourself.
-- The expression index complements the directional unique index already in place.
ALTER TABLE public.friend_requests
  ADD CONSTRAINT friend_requests_no_self_request
  CHECK (requester_id <> receiver_id);

CREATE UNIQUE INDEX friend_requests_unique_pair_idx
  ON public.friend_requests (
    LEAST(requester_id, receiver_id),
    GREATEST(requester_id, receiver_id)
  );
