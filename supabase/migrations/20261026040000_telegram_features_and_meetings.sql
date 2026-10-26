-- MYGRAM shared messaging capabilities inspired by modern messengers.
-- Additive only: no existing messages, users, or chats are removed.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

-- Shared metadata preserves the distinct Messenger and WHATSMYGRAM products,
-- while giving both the same topics, pins, polls, and moderation model.
create table if not exists public.messaging_space_meta (
  source text not null check (source in ('messenger','whatsmygram')),
  space_id uuid not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  space_type text not null default 'group' check (space_type in ('direct','group','channel','forum')),
  visibility text not null default 'private' check (visibility in ('private','public')),
  display_name text,
  description text not null default '',
  public_slug text unique,
  allow_member_posts boolean not null default true,
  settings jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (source, space_id),
  check (public_slug is null or public_slug ~ '^[a-z0-9_]{4,40}$'),
  check (char_length(description) <= 2000),
  check (display_name is null or char_length(btrim(display_name)) between 1 and 100)
);

create or replace function private.is_messaging_member(p_source text, p_space_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql stable security definer
set search_path = pg_catalog, public, auth, private
as $$
  select case p_source
    when 'messenger' then exists (
      select 1 from public.chats c
      where c.id = p_space_id and c.created_by = p_user_id
      union all
      select 1 from public.chat_members m where m.chat_id = p_space_id and m.user_id = p_user_id
    )
    when 'whatsmygram' then exists (
      select 1 from public.whatsmygram_chats c
      where c.id = p_space_id and c.created_by = p_user_id
      union all
      select 1 from public.whatsmygram_chat_members m where m.chat_id = p_space_id and m.user_id = p_user_id
    )
    else false
  end;
$$;

create or replace function private.can_manage_messaging_space(
  p_source text, p_space_id uuid, p_permission text, p_user_id uuid default auth.uid()
)
returns boolean
language sql stable security definer
set search_path = pg_catalog, public, auth, private
as $$
  select exists (
    select 1 from public.messaging_space_meta s
    where s.source = p_source and s.space_id = p_space_id and s.created_by = p_user_id
  ) or exists (
    select 1 from public.messaging_moderators m
    where m.source = p_source and m.space_id = p_space_id and m.user_id = p_user_id
      and (p_permission = any(m.permissions) or 'manage' = any(m.permissions))
  );
$$;

revoke all on function private.is_messaging_member(text, uuid, uuid) from public, anon;
revoke all on function private.can_manage_messaging_space(text, uuid, text, uuid) from public, anon;
grant execute on function private.is_messaging_member(text, uuid, uuid) to authenticated;
grant execute on function private.can_manage_messaging_space(text, uuid, text, uuid) to authenticated;

create table if not exists public.messaging_moderators (
  source text not null check (source in ('messenger','whatsmygram')),
  space_id uuid not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  permissions text[] not null default array['pin','topics','polls','moderate']::text[],
  added_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (source, space_id, user_id),
  check (cardinality(permissions) between 1 and 8),
  check (permissions <@ array['pin','topics','polls','moderate','post','invite','manage']::text[])
);

alter table public.messaging_space_meta enable row level security;
alter table public.messaging_moderators enable row level security;

drop policy if exists messaging_space_meta_read on public.messaging_space_meta;
create policy messaging_space_meta_read on public.messaging_space_meta
for select to authenticated
using (visibility = 'public' or private.is_messaging_member(source, space_id));
drop policy if exists messaging_space_meta_insert_owner on public.messaging_space_meta;
create policy messaging_space_meta_insert_owner on public.messaging_space_meta
for insert to authenticated with check (
  created_by = (select auth.uid()) and private.is_messaging_member(source, space_id)
);
drop policy if exists messaging_space_meta_update_owner on public.messaging_space_meta;
create policy messaging_space_meta_update_owner on public.messaging_space_meta
for update to authenticated
using (created_by = (select auth.uid()))
with check (created_by = (select auth.uid()));
drop policy if exists messaging_moderators_read on public.messaging_moderators;
create policy messaging_moderators_read on public.messaging_moderators
for select to authenticated using (private.is_messaging_member(source, space_id));
drop policy if exists messaging_moderators_manage_by_creator on public.messaging_moderators;
create policy messaging_moderators_manage_by_creator on public.messaging_moderators
for all to authenticated
using (exists (
  select 1 from public.messaging_space_meta s
  where s.source = messaging_moderators.source and s.space_id = messaging_moderators.space_id
    and s.created_by = (select auth.uid())
))
with check (
  added_by = (select auth.uid()) and exists (
    select 1 from public.messaging_space_meta s
    where s.source = messaging_moderators.source and s.space_id = messaging_moderators.space_id
      and s.created_by = (select auth.uid())
  )
);

grant select, insert, update, delete on public.messaging_space_meta, public.messaging_moderators to authenticated;

create or replace function private.seed_messaging_space_meta()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public, auth, private
as $$
declare
  v_source text := TG_ARGV[0];
  v_is_group boolean := coalesce((to_jsonb(NEW)->>'is_group')::boolean, false);
begin
  insert into public.messaging_space_meta(source, space_id, created_by, space_type, display_name)
  values (v_source, (to_jsonb(NEW)->>'id')::uuid, (to_jsonb(NEW)->>'created_by')::uuid,
          case when v_is_group then 'group' else 'direct' end, nullif(to_jsonb(NEW)->>'title',''))
  on conflict (source, space_id) do nothing;
  return NEW;
end;
$$;
drop trigger if exists seed_messenger_space_meta on public.chats;
create trigger seed_messenger_space_meta after insert on public.chats
for each row execute function private.seed_messaging_space_meta('messenger');
drop trigger if exists seed_whatsmygram_space_meta on public.whatsmygram_chats;
create trigger seed_whatsmygram_space_meta after insert on public.whatsmygram_chats
for each row execute function private.seed_messaging_space_meta('whatsmygram');

insert into public.messaging_space_meta(source, space_id, created_by, space_type, display_name)
select 'messenger', c.id, c.created_by, case when c.is_group then 'group' else 'direct' end, nullif(c.title,'')
from public.chats c on conflict (source, space_id) do nothing;
insert into public.messaging_space_meta(source, space_id, created_by, space_type, display_name)
select 'whatsmygram', c.id, c.created_by, case when c.is_group then 'group' else 'direct' end, nullif(c.title,'')
from public.whatsmygram_chats c on conflict (source, space_id) do nothing;

create table if not exists public.messaging_topics (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('messenger','whatsmygram')),
  space_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 80),
  description text not null default '' check (char_length(description) <= 500),
  created_by uuid not null references auth.users(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, source, space_id)
);
create index if not exists messaging_topics_space_idx on public.messaging_topics(source, space_id, position, created_at);

create table if not exists public.messaging_pins (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('messenger','whatsmygram')),
  space_id uuid not null,
  message_id uuid not null,
  pinned_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (source, space_id, message_id)
);
create index if not exists messaging_pins_space_idx on public.messaging_pins(source, space_id, created_at desc);

create table if not exists public.messaging_bookmarks (
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('messenger','whatsmygram','direct')),
  space_id uuid,
  message_id uuid not null,
  label text not null default '' check (char_length(label) <= 160),
  created_at timestamptz not null default now(),
  primary key (user_id, source, message_id),
  check ((source = 'direct' and space_id is null) or (source <> 'direct' and space_id is not null))
);

create table if not exists public.messaging_polls (
  id uuid primary key default gen_random_uuid(),
  source text not null check (source in ('messenger','whatsmygram')),
  space_id uuid not null,
  created_by uuid not null references auth.users(id) on delete cascade,
  question text not null check (char_length(btrim(question)) between 1 and 500),
  poll_type text not null default 'poll' check (poll_type in ('poll','quiz')),
  is_anonymous boolean not null default false,
  closes_at timestamptz,
  closed_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists messaging_polls_space_idx on public.messaging_polls(source, space_id, created_at desc);

create table if not exists public.messaging_poll_options (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.messaging_polls(id) on delete cascade,
  option_text text not null check (char_length(btrim(option_text)) between 1 and 200),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (poll_id, position)
);
create table if not exists public.messaging_poll_votes (
  poll_id uuid not null references public.messaging_polls(id) on delete cascade,
  option_id uuid not null references public.messaging_poll_options(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (poll_id, user_id)
);

alter table public.messaging_topics enable row level security;
alter table public.messaging_pins enable row level security;
alter table public.messaging_bookmarks enable row level security;
alter table public.messaging_polls enable row level security;
alter table public.messaging_poll_options enable row level security;
alter table public.messaging_poll_votes enable row level security;

drop policy if exists messaging_topics_read_members on public.messaging_topics;
create policy messaging_topics_read_members on public.messaging_topics for select to authenticated
using (private.is_messaging_member(source, space_id));
drop policy if exists messaging_topics_manage on public.messaging_topics;
create policy messaging_topics_manage on public.messaging_topics for all to authenticated
using (private.can_manage_messaging_space(source, space_id, 'topics'))
with check (created_by = (select auth.uid()) and private.can_manage_messaging_space(source, space_id, 'topics'));

drop policy if exists messaging_pins_read_members on public.messaging_pins;
create policy messaging_pins_read_members on public.messaging_pins for select to authenticated
using (private.is_messaging_member(source, space_id));
drop policy if exists messaging_pins_manage on public.messaging_pins;
create policy messaging_pins_manage on public.messaging_pins for all to authenticated
using (private.can_manage_messaging_space(source, space_id, 'pin'))
with check (pinned_by = (select auth.uid()) and private.can_manage_messaging_space(source, space_id, 'pin'));

drop policy if exists messaging_bookmarks_read_own on public.messaging_bookmarks;
create policy messaging_bookmarks_read_own on public.messaging_bookmarks for select to authenticated
using (user_id = (select auth.uid()));
drop policy if exists messaging_bookmarks_insert_own on public.messaging_bookmarks;
create policy messaging_bookmarks_insert_own on public.messaging_bookmarks for insert to authenticated
with check (
  user_id = (select auth.uid()) and (
    (source = 'messenger' and private.is_messaging_member(source, space_id) and exists (
      select 1 from public.chat_messages m where m.id = message_id and m.chat_id = space_id
    )) or
    (source = 'whatsmygram' and private.is_messaging_member(source, space_id) and exists (
      select 1 from public.whatsmygram_messages m where m.id = message_id and m.chat_id = space_id
    )) or
    (source = 'direct' and exists (
      select 1 from public.direct_messages m where m.id = message_id and (m.sender_id = (select auth.uid()) or m.recipient_id = (select auth.uid()))
    ))
  )
);
drop policy if exists messaging_bookmarks_delete_own on public.messaging_bookmarks;
create policy messaging_bookmarks_delete_own on public.messaging_bookmarks for delete to authenticated
using (user_id = (select auth.uid()));

drop policy if exists messaging_polls_read_members on public.messaging_polls;
create policy messaging_polls_read_members on public.messaging_polls for select to authenticated
using (private.is_messaging_member(source, space_id));
drop policy if exists messaging_polls_insert_members on public.messaging_polls;
create policy messaging_polls_insert_members on public.messaging_polls for insert to authenticated
with check (created_by = (select auth.uid()) and private.is_messaging_member(source, space_id));
drop policy if exists messaging_polls_update_author_or_moderator on public.messaging_polls;
create policy messaging_polls_update_author_or_moderator on public.messaging_polls for update to authenticated
using (created_by = (select auth.uid()) or private.can_manage_messaging_space(source, space_id, 'polls'))
with check (created_by = (select auth.uid()) or private.can_manage_messaging_space(source, space_id, 'polls'));

drop policy if exists messaging_poll_options_read_members on public.messaging_poll_options;
create policy messaging_poll_options_read_members on public.messaging_poll_options for select to authenticated
using (exists (select 1 from public.messaging_polls p where p.id = poll_id and private.is_messaging_member(p.source, p.space_id)));
drop policy if exists messaging_poll_options_manage_author on public.messaging_poll_options;
create policy messaging_poll_options_manage_author on public.messaging_poll_options for all to authenticated
using (exists (select 1 from public.messaging_polls p where p.id = poll_id and (p.created_by = (select auth.uid()) or private.can_manage_messaging_space(p.source, p.space_id, 'polls'))))
with check (exists (select 1 from public.messaging_polls p where p.id = poll_id and (p.created_by = (select auth.uid()) or private.can_manage_messaging_space(p.source, p.space_id, 'polls'))));

drop policy if exists messaging_poll_votes_read_members on public.messaging_poll_votes;
create policy messaging_poll_votes_read_members on public.messaging_poll_votes for select to authenticated
using (exists (select 1 from public.messaging_polls p where p.id = poll_id and private.is_messaging_member(p.source, p.space_id)));
drop policy if exists messaging_poll_votes_insert_own on public.messaging_poll_votes;
create policy messaging_poll_votes_insert_own on public.messaging_poll_votes for insert to authenticated
with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.messaging_polls p
    join public.messaging_poll_options o on o.poll_id = p.id
    where p.id = poll_id and o.id = option_id
      and private.is_messaging_member(p.source, p.space_id)
      and p.closed_at is null and (p.closes_at is null or p.closes_at > now())
  )
);
drop policy if exists messaging_poll_votes_change_own on public.messaging_poll_votes;
create policy messaging_poll_votes_change_own on public.messaging_poll_votes for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()) and exists (
  select 1 from public.messaging_polls p
  join public.messaging_poll_options o on o.poll_id = p.id
  where p.id = poll_id and o.id = option_id and private.is_messaging_member(p.source, p.space_id)
    and p.closed_at is null and (p.closes_at is null or p.closes_at > now())
));
drop policy if exists messaging_poll_votes_delete_own on public.messaging_poll_votes;
create policy messaging_poll_votes_delete_own on public.messaging_poll_votes for delete to authenticated
using (user_id = (select auth.uid()));

grant select, insert, update, delete on
  public.messaging_topics, public.messaging_pins, public.messaging_bookmarks,
  public.messaging_polls, public.messaging_poll_options, public.messaging_poll_votes
to authenticated;

-- Attach a topic and edit metadata to the existing message storage without moving messages.
alter table public.chat_messages
  add column if not exists topic_id uuid references public.messaging_topics(id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists reply_to_message_id uuid;
alter table public.whatsmygram_messages
  add column if not exists topic_id uuid references public.messaging_topics(id) on delete set null,
  add column if not exists edited_at timestamptz,
  add column if not exists expires_at timestamptz,
  add column if not exists reply_to_message_id uuid;

create or replace function private.validate_messaging_message_features()
returns trigger
language plpgsql security definer
set search_path = pg_catalog, public, auth, private
as $$
declare v_source text := TG_ARGV[0]; v_parent_chat uuid; v_topic public.messaging_topics%rowtype;
begin
  if new.topic_id is not null then
    select * into v_topic from public.messaging_topics where id = new.topic_id;
    if not found or v_topic.source <> v_source or v_topic.space_id <> new.chat_id
      or not private.is_messaging_member(v_source, new.chat_id, auth.uid()) then
      raise exception 'The selected topic does not belong to this conversation.';
    end if;
  end if;
  if new.reply_to_message_id is not null then
    if v_source = 'messenger' then
      select chat_id into v_parent_chat from public.chat_messages where id = new.reply_to_message_id;
    else
      select chat_id into v_parent_chat from public.whatsmygram_messages where id = new.reply_to_message_id;
    end if;
    if v_parent_chat is distinct from new.chat_id then
      raise exception 'A reply must target a message in the same conversation.';
    end if;
  end if;
  if exists (select 1 from public.messaging_space_meta s
    where s.source = v_source and s.space_id = new.chat_id and s.space_type = 'channel' and not s.allow_member_posts)
    and not private.can_manage_messaging_space(v_source, new.chat_id, 'post', new.sender_id) then
    raise exception 'Only channel managers can publish to this channel.';
  end if;
  return new;
end;
$$;
drop trigger if exists validate_chat_message_features on public.chat_messages;
create trigger validate_chat_message_features before insert or update of topic_id, reply_to_message_id on public.chat_messages
for each row execute function private.validate_messaging_message_features('messenger');
drop trigger if exists validate_whatsmygram_message_features on public.whatsmygram_messages;
create trigger validate_whatsmygram_message_features before insert or update of topic_id, reply_to_message_id on public.whatsmygram_messages
for each row execute function private.validate_messaging_message_features('whatsmygram');

-- Allow channel followers to read public channel history; membership remains required for private spaces.
drop policy if exists chat_messages_read_public_channels on public.chat_messages;
create policy chat_messages_read_public_channels on public.chat_messages for select to authenticated
using (exists (select 1 from public.messaging_space_meta s where s.source='messenger' and s.space_id=chat_id and s.space_type='channel' and s.visibility='public'));
drop policy if exists whatsmygram_messages_read_public_channels on public.whatsmygram_messages;
create policy whatsmygram_messages_read_public_channels on public.whatsmygram_messages for select to authenticated
using (exists (select 1 from public.messaging_space_meta s where s.source='whatsmygram' and s.space_id=chat_id and s.space_type='channel' and s.visibility='public'));

-- Meetings: 30 participants plus a chair/host, a dedicated text room, attendance,
-- multilingual transcript/summary records, and an auditable chair handover.
create table if not exists public.meetings (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 2 and 160),
  agenda text not null default '' check (char_length(agenda) <= 10000),
  created_by uuid not null references auth.users(id) on delete cascade,
  chair_user_id uuid not null references auth.users(id),
  invite_code text not null unique default encode(gen_random_bytes(16), 'hex'),
  status text not null default 'scheduled' check (status in ('scheduled','live','ended','cancelled')),
  max_participants integer not null default 31 check (max_participants between 2 and 31),
  preferred_language text not null default 'ar' check (preferred_language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  video_provider text not null default 'livekit' check (video_provider in ('livekit','disabled')),
  recording_consent text not null default 'ask_each_participant' check (recording_consent in ('ask_each_participant','all_consented','disabled')),
  starts_at timestamptz,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists meetings_creator_idx on public.meetings(created_by, created_at desc);
create index if not exists meetings_status_idx on public.meetings(status, starts_at);

create table if not exists public.meeting_participants (
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'participant' check (role in ('host','chair','presenter','participant')),
  preferred_language text check (preferred_language is null or preferred_language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  recording_consent boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  last_seen_at timestamptz,
  primary key (meeting_id, user_id)
);
create index if not exists meeting_participants_user_idx on public.meeting_participants(user_id, joined_at desc);

create table if not exists public.meeting_messages (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 1 and 10000),
  reply_to_message_id uuid references public.meeting_messages(id) on delete set null,
  edited_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists meeting_messages_room_idx on public.meeting_messages(meeting_id, created_at);

create table if not exists public.meeting_transcripts (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  speaker_id uuid references auth.users(id) on delete set null,
  language_code text not null default 'und' check (language_code ~ '^[a-z]{2,3}(-[A-Z]{2})?$' or language_code = 'und'),
  transcript_text text not null check (char_length(btrim(transcript_text)) between 1 and 12000),
  source text not null default 'manual' check (source in ('manual','browser_speech','ai_provider','imported')),
  captured_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete cascade
);
create index if not exists meeting_transcripts_room_idx on public.meeting_transcripts(meeting_id, captured_at);

create table if not exists public.meeting_minutes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  recipient_id uuid not null references auth.users(id) on delete cascade,
  language_code text not null check (language_code ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  status text not null default 'draft' check (status in ('draft','processing','ready','failed')),
  summary_markdown text not null default '',
  key_points jsonb not null default '[]'::jsonb check (jsonb_typeof(key_points) = 'array'),
  explanations jsonb not null default '[]'::jsonb check (jsonb_typeof(explanations) = 'array'),
  pdf_storage_path text,
  generated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (meeting_id, recipient_id, language_code)
);
create index if not exists meeting_minutes_recipient_idx on public.meeting_minutes(recipient_id, created_at desc);

create table if not exists public.meeting_chair_transfers (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references public.meetings(id) on delete cascade,
  previous_chair_id uuid not null references auth.users(id),
  next_chair_id uuid not null references auth.users(id),
  transferred_by uuid not null references auth.users(id),
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  check (previous_chair_id <> next_chair_id)
);
create index if not exists meeting_chair_transfers_room_idx on public.meeting_chair_transfers(meeting_id, created_at);

create or replace function private.is_meeting_member(p_meeting_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer
set search_path = pg_catalog, public, auth, private
as $$
  select exists (select 1 from public.meeting_participants p where p.meeting_id=p_meeting_id and p.user_id=p_user_id and p.left_at is null);
$$;
revoke all on function private.is_meeting_member(uuid,uuid) from public, anon;
grant execute on function private.is_meeting_member(uuid,uuid) to authenticated;

create or replace function private.add_meeting_creator_as_participant()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, auth, private
as $$
begin
  insert into public.meeting_participants(meeting_id,user_id,role,preferred_language)
  values (new.id,new.created_by,'host',new.preferred_language)
  on conflict (meeting_id,user_id) do nothing;
  return new;
end;
$$;
drop trigger if exists add_meeting_creator_participant on public.meetings;
create trigger add_meeting_creator_participant after insert on public.meetings
for each row execute function private.add_meeting_creator_as_participant();

create or replace function private.enforce_meeting_capacity()
returns trigger language plpgsql security definer
set search_path = pg_catalog, public, auth, private
as $$
declare v_limit integer; v_status text; v_count integer;
begin
  select max_participants,status into v_limit,v_status from public.meetings where id=new.meeting_id for update;
  if not found then raise exception 'Meeting not found.'; end if;
  if v_status in ('ended','cancelled') then raise exception 'This meeting is no longer accepting participants.'; end if;
  if new.left_at is null then
    select count(*) into v_count from public.meeting_participants where meeting_id=new.meeting_id and left_at is null and user_id <> new.user_id;
    if v_count >= v_limit then raise exception 'Meeting is full (maximum 31 participants including the host).'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists meeting_participant_capacity_guard on public.meeting_participants;
create trigger meeting_participant_capacity_guard before insert or update of left_at on public.meeting_participants
for each row execute function private.enforce_meeting_capacity();

create or replace function public.join_meeting(p_invite_code text, p_language_code text default null)
returns uuid language plpgsql security definer
set search_path = pg_catalog, public, auth, private
as $$
declare v_meeting public.meetings%rowtype; v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Sign in to join this meeting.'; end if;
  select * into v_meeting from public.meetings where invite_code=p_invite_code for update;
  if not found then raise exception 'Invitation link is invalid.'; end if;
  if v_meeting.status in ('ended','cancelled') then raise exception 'This meeting has ended.'; end if;
  insert into public.meeting_participants(meeting_id,user_id,role,preferred_language)
  values (v_meeting.id,v_uid,'participant',coalesce(p_language_code, v_meeting.preferred_language))
  on conflict (meeting_id,user_id) do update set left_at=null, last_seen_at=now(),
    preferred_language=coalesce(excluded.preferred_language, public.meeting_participants.preferred_language);
  return v_meeting.id;
end;
$$;
revoke all on function public.join_meeting(text,text) from public, anon;
grant execute on function public.join_meeting(text,text) to authenticated;

create or replace function public.transfer_meeting_chair(p_meeting_id uuid, p_new_chair_id uuid, p_note text default '')
returns void language plpgsql security definer
set search_path = pg_catalog, public, auth, private
as $$
declare v_uid uuid := auth.uid(); v_old_chair uuid;
begin
  if v_uid is null then raise exception 'Sign in required.'; end if;
  select chair_user_id into v_old_chair from public.meetings where id=p_meeting_id and status <> 'ended' for update;
  if not found then raise exception 'Meeting not found or already ended.'; end if;
  if v_uid <> v_old_chair and not exists (
    select 1 from public.meetings where id=p_meeting_id and created_by=v_uid
  ) then raise exception 'Only the current chair or meeting host can transfer the chair.'; end if;
  if p_new_chair_id = v_old_chair then return; end if;
  if not exists (select 1 from public.meeting_participants where meeting_id=p_meeting_id and user_id=p_new_chair_id and left_at is null) then
    raise exception 'The new chair must be an active participant.'; end if;
  update public.meetings set chair_user_id=p_new_chair_id, updated_at=now() where id=p_meeting_id;
  update public.meeting_participants set role=case when user_id=p_new_chair_id then 'chair' when user_id=v_old_chair then case when user_id=created_by then 'host' else 'participant' end else role end
  where meeting_id=p_meeting_id;
  insert into public.meeting_chair_transfers(meeting_id,previous_chair_id,next_chair_id,transferred_by,note)
  values (p_meeting_id,v_old_chair,p_new_chair_id,v_uid,left(coalesce(p_note,''),1000));
end;
$$;
-- Correct role promotion/demotion without referring to meeting columns from a participant row.
create or replace function public.transfer_meeting_chair(p_meeting_id uuid, p_new_chair_id uuid, p_note text default '')
returns void language plpgsql security definer
set search_path = pg_catalog, public, auth, private
as $$
declare v_uid uuid := auth.uid(); v_old_chair uuid; v_creator uuid;
begin
  if v_uid is null then raise exception 'Sign in required.'; end if;
  select chair_user_id,created_by into v_old_chair,v_creator from public.meetings where id=p_meeting_id and status <> 'ended' for update;
  if not found then raise exception 'Meeting not found or already ended.'; end if;
  if v_uid <> v_old_chair and v_uid <> v_creator then raise exception 'Only the current chair or meeting host can transfer the chair.'; end if;
  if p_new_chair_id = v_old_chair then return; end if;
  if not exists (select 1 from public.meeting_participants where meeting_id=p_meeting_id and user_id=p_new_chair_id and left_at is null) then
    raise exception 'The new chair must be an active participant.'; end if;
  update public.meetings set chair_user_id=p_new_chair_id, updated_at=now() where id=p_meeting_id;
  update public.meeting_participants set role=case
    when user_id=p_new_chair_id then case when user_id=v_creator then 'host' else 'chair' end
    when user_id=v_old_chair then case when user_id=v_creator then 'host' else 'participant' end
    else role end
  where meeting_id=p_meeting_id;
  insert into public.meeting_chair_transfers(meeting_id,previous_chair_id,next_chair_id,transferred_by,note)
  values (p_meeting_id,v_old_chair,p_new_chair_id,v_uid,left(coalesce(p_note,''),1000));
end;
$$;
revoke all on function public.transfer_meeting_chair(uuid,uuid,text) from public, anon;
grant execute on function public.transfer_meeting_chair(uuid,uuid,text) to authenticated;

alter table public.meetings enable row level security;
alter table public.meeting_participants enable row level security;
alter table public.meeting_messages enable row level security;
alter table public.meeting_transcripts enable row level security;
alter table public.meeting_minutes enable row level security;
alter table public.meeting_chair_transfers enable row level security;

drop policy if exists meetings_read_members on public.meetings;
create policy meetings_read_members on public.meetings for select to authenticated
using (created_by=(select auth.uid()) or private.is_meeting_member(id));
drop policy if exists meetings_create_self on public.meetings;
create policy meetings_create_self on public.meetings for insert to authenticated
with check (created_by=(select auth.uid()) and chair_user_id=(select auth.uid()));

drop policy if exists meeting_participants_read_members on public.meeting_participants;
create policy meeting_participants_read_members on public.meeting_participants for select to authenticated
using (private.is_meeting_member(meeting_id) or exists (select 1 from public.meetings m where m.id=meeting_id and m.created_by=(select auth.uid())));
drop policy if exists meeting_participants_update_self on public.meeting_participants;
create policy meeting_participants_update_self on public.meeting_participants for update to authenticated
using (user_id=(select auth.uid()) and private.is_meeting_member(meeting_id))
with check (user_id=(select auth.uid()) and private.is_meeting_member(meeting_id));
-- Participants are added only by the creator trigger or the validated join_meeting RPC.

drop policy if exists meeting_messages_read_members on public.meeting_messages;
create policy meeting_messages_read_members on public.meeting_messages for select to authenticated
using (private.is_meeting_member(meeting_id));
drop policy if exists meeting_messages_send_self on public.meeting_messages;
create policy meeting_messages_send_self on public.meeting_messages for insert to authenticated
with check (sender_id=(select auth.uid()) and private.is_meeting_member(meeting_id));
drop policy if exists meeting_messages_edit_own on public.meeting_messages;
create policy meeting_messages_edit_own on public.meeting_messages for update to authenticated
using (sender_id=(select auth.uid()) and private.is_meeting_member(meeting_id))
with check (sender_id=(select auth.uid()) and private.is_meeting_member(meeting_id));
drop policy if exists meeting_messages_delete_own on public.meeting_messages;
create policy meeting_messages_delete_own on public.meeting_messages for delete to authenticated
using (sender_id=(select auth.uid()) and private.is_meeting_member(meeting_id));

drop policy if exists meeting_transcripts_read_members on public.meeting_transcripts;
create policy meeting_transcripts_read_members on public.meeting_transcripts for select to authenticated
using (private.is_meeting_member(meeting_id));
drop policy if exists meeting_transcripts_add_self on public.meeting_transcripts;
create policy meeting_transcripts_add_self on public.meeting_transcripts for insert to authenticated
with check (created_by=(select auth.uid()) and (speaker_id is null or speaker_id=(select auth.uid())) and private.is_meeting_member(meeting_id));

drop policy if exists meeting_minutes_read_recipient on public.meeting_minutes;
create policy meeting_minutes_read_recipient on public.meeting_minutes for select to authenticated
using (recipient_id=(select auth.uid()) and private.is_meeting_member(meeting_id));
drop policy if exists meeting_chair_transfers_read_members on public.meeting_chair_transfers;
create policy meeting_chair_transfers_read_members on public.meeting_chair_transfers for select to authenticated
using (private.is_meeting_member(meeting_id));

grant select, insert on public.meetings to authenticated;
grant select, update on public.meeting_participants to authenticated;
grant select, insert, update, delete on public.meeting_messages to authenticated;
grant select, insert on public.meeting_transcripts to authenticated;
grant select on public.meeting_minutes, public.meeting_chair_transfers to authenticated;

-- Keep realtime available for live meeting chat and group messaging enhancements.
do $$
begin
  if exists (select 1 from pg_publication where pubname='supabase_realtime') then
    begin alter publication supabase_realtime add table public.meeting_messages; exception when duplicate_object then null; when undefined_object then null; end;
    begin alter publication supabase_realtime add table public.messaging_pins; exception when duplicate_object then null; when undefined_object then null; end;
    begin alter publication supabase_realtime add table public.messaging_poll_votes; exception when duplicate_object then null; when undefined_object then null; end;
  end if;
end;
$$;
