-- Private object storage for direct-message media.
-- Store object paths in direct_messages.attachment_url, never public URLs.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mygram-private-messages',
  'mygram-private-messages',
  false,
  52428800,
  array[
    'image/jpeg','image/png','image/webp','image/gif','image/avif',
    'video/mp4','video/webm','video/quicktime','video/ogg',
    'audio/webm','audio/ogg','audio/mp4','audio/mpeg','audio/wav','audio/aac','audio/3gpp'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "MYGRAM private message media upload own folder" on storage.objects;
create policy "MYGRAM private message media upload own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'mygram-private-messages'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);

drop policy if exists "MYGRAM private message media read participants" on storage.objects;
create policy "MYGRAM private message media read participants"
on storage.objects for select to authenticated
using (
  bucket_id = 'mygram-private-messages'
  and exists (
    select 1
    from public.direct_messages dm
    where dm.attachment_url = storage.objects.name
      and (dm.sender_id = (select auth.uid()) or dm.recipient_id = (select auth.uid()))
  )
);

drop policy if exists "MYGRAM private message media delete own folder" on storage.objects;
create policy "MYGRAM private message media delete own folder"
on storage.objects for delete to authenticated
using (
  bucket_id = 'mygram-private-messages'
  and (storage.foldername(name))[1] = (select auth.uid())::text
);
