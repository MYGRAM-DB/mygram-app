-- Add media attachments and voice-note metadata to MYGRAM direct messages.
-- Message body remains non-null for compatibility with existing clients; media-only
-- sends use a short descriptive body while the actual file is stored in Storage.
alter table public.direct_messages
  add column if not exists attachment_url text,
  add column if not exists attachment_type text,
  add column if not exists duration_seconds integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'direct_messages_attachment_type_check'
      and conrelid = 'public.direct_messages'::regclass
  ) then
    alter table public.direct_messages
      add constraint direct_messages_attachment_type_check
      check (attachment_type is null or attachment_type in ('image','video','audio'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'direct_messages_duration_seconds_check'
      and conrelid = 'public.direct_messages'::regclass
  ) then
    alter table public.direct_messages
      add constraint direct_messages_duration_seconds_check
      check (duration_seconds is null or duration_seconds between 1 and 600);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'direct_messages_attachment_required_check'
      and conrelid = 'public.direct_messages'::regclass
  ) then
    alter table public.direct_messages
      add constraint direct_messages_attachment_required_check
      check (
        (attachment_url is null and attachment_type is null)
        or (attachment_url is not null and attachment_type is not null)
      );
  end if;
end $$;

create index if not exists direct_messages_pair_created_idx
  on public.direct_messages (sender_id, recipient_id, created_at desc);
