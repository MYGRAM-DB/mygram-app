-- Require opt-in from every active attendee before transcripts can be captured.
drop policy if exists meeting_transcripts_add_self on public.meeting_transcripts;
create policy meeting_transcripts_add_self on public.meeting_transcripts for insert to authenticated
with check (
  created_by=(select auth.uid())
  and (speaker_id is null or speaker_id=(select auth.uid()))
  and private.is_meeting_member(meeting_id)
  and not exists (
    select 1 from public.meeting_participants p
    where p.meeting_id=meeting_transcripts.meeting_id and p.left_at is null
      and p.recording_consent is not true
  )
);

create or replace function public.update_meeting_status(p_meeting_id uuid, p_status text)
returns void language plpgsql security definer
set search_path = pg_catalog, public, auth, private
as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_chair uuid; v_status text;
begin
  if v_uid is null then raise exception 'Sign in required.'; end if;
  if p_status not in ('live','ended','cancelled') then raise exception 'Unsupported meeting status.'; end if;
  select created_by,chair_user_id,status into v_owner,v_chair,v_status
  from public.meetings where id=p_meeting_id for update;
  if not found then raise exception 'Meeting not found.'; end if;
  if v_uid <> v_owner and v_uid <> v_chair then raise exception 'Only the host or chair can change meeting status.'; end if;
  if v_status='ended' or v_status='cancelled' then
    if p_status <> v_status then raise exception 'A finished meeting cannot be reopened.'; end if;
    return;
  end if;
  if p_status='live' and v_status='scheduled' then
    update public.meetings set status='live',started_at=coalesce(started_at,now()),updated_at=now() where id=p_meeting_id;
  elsif p_status='ended' and v_status in ('scheduled','live') then
    update public.meetings set status='ended',ended_at=now(),updated_at=now() where id=p_meeting_id;
  elsif p_status='cancelled' and v_status='scheduled' and v_uid=v_owner then
    update public.meetings set status='cancelled',ended_at=now(),updated_at=now() where id=p_meeting_id;
  else
    raise exception 'Invalid meeting state transition.';
  end if;
end;
$$;
revoke all on function public.update_meeting_status(uuid,text) from public, anon;
grant execute on function public.update_meeting_status(uuid,text) to authenticated;
