-- Preserve access to prior meeting materials for people who attended and later left.
create or replace function private.has_meeting_access(p_meeting_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path = pg_catalog, public, auth, private
as $$
  select exists (
    select 1 from public.meeting_participants p
    where p.meeting_id=p_meeting_id and p.user_id=p_user_id
  );
$$;
revoke all on function private.has_meeting_access(uuid,uuid) from public, anon;
grant execute on function private.has_meeting_access(uuid,uuid) to authenticated;

drop policy if exists meetings_read_members on public.meetings;
create policy meetings_read_members on public.meetings for select to authenticated
using (created_by=(select auth.uid()) or private.has_meeting_access(id));

drop policy if exists meeting_participants_read_members on public.meeting_participants;
create policy meeting_participants_read_members on public.meeting_participants for select to authenticated
using (private.has_meeting_access(meeting_id) or exists (
  select 1 from public.meetings m where m.id=meeting_id and m.created_by=(select auth.uid())
));

drop policy if exists meeting_messages_read_members on public.meeting_messages;
create policy meeting_messages_read_members on public.meeting_messages for select to authenticated
using (private.has_meeting_access(meeting_id));

drop policy if exists meeting_transcripts_read_members on public.meeting_transcripts;
create policy meeting_transcripts_read_members on public.meeting_transcripts for select to authenticated
using (private.has_meeting_access(meeting_id));

drop policy if exists meeting_minutes_read_recipient on public.meeting_minutes;
create policy meeting_minutes_read_recipient on public.meeting_minutes for select to authenticated
using (recipient_id=(select auth.uid()) and private.has_meeting_access(meeting_id));

drop policy if exists meeting_chair_transfers_read_members on public.meeting_chair_transfers;
create policy meeting_chair_transfers_read_members on public.meeting_chair_transfers for select to authenticated
using (private.has_meeting_access(meeting_id));

-- Indexes for newly introduced foreign keys and common room lookups.
create index if not exists chat_messages_topic_id_idx on public.chat_messages(topic_id) where topic_id is not null;
create index if not exists whatsmygram_messages_topic_id_idx on public.whatsmygram_messages(topic_id) where topic_id is not null;
create index if not exists messaging_space_meta_created_by_idx on public.messaging_space_meta(created_by);
create index if not exists messaging_moderators_user_idx on public.messaging_moderators(user_id);
create index if not exists messaging_moderators_added_by_idx on public.messaging_moderators(added_by);
create index if not exists messaging_topics_created_by_idx on public.messaging_topics(created_by);
create index if not exists messaging_pins_pinned_by_idx on public.messaging_pins(pinned_by);
create index if not exists messaging_polls_created_by_idx on public.messaging_polls(created_by);
create index if not exists messaging_poll_votes_option_idx on public.messaging_poll_votes(option_id);
create index if not exists messaging_poll_votes_user_idx on public.messaging_poll_votes(user_id);
create index if not exists meetings_chair_user_idx on public.meetings(chair_user_id);
create index if not exists meeting_participants_active_room_idx on public.meeting_participants(meeting_id,user_id) where left_at is null;
create index if not exists meeting_messages_sender_idx on public.meeting_messages(sender_id);
create index if not exists meeting_messages_reply_idx on public.meeting_messages(reply_to_message_id) where reply_to_message_id is not null;
create index if not exists meeting_transcripts_speaker_idx on public.meeting_transcripts(speaker_id);
create index if not exists meeting_transcripts_created_by_idx on public.meeting_transcripts(created_by);
create index if not exists meeting_minutes_meeting_idx on public.meeting_minutes(meeting_id);
create index if not exists meeting_chair_transfers_previous_idx on public.meeting_chair_transfers(previous_chair_id);
create index if not exists meeting_chair_transfers_next_idx on public.meeting_chair_transfers(next_chair_id);
create index if not exists meeting_chair_transfers_actor_idx on public.meeting_chair_transfers(transferred_by);
