-- Pin SECURITY DEFINER name resolution and require an active chair for chair actions.
-- CREATE OR REPLACE preserves the existing function grants.
create or replace function public.join_meeting(p_invite_code text, p_language_code text default null)
returns uuid language plpgsql security definer
set search_path = ''
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

create or replace function public.transfer_meeting_chair(p_meeting_id uuid, p_new_chair_id uuid, p_note text default '')
returns void language plpgsql security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_old_chair uuid; v_creator uuid;
begin
  if v_uid is null then raise exception 'Sign in required.'; end if;
  select chair_user_id,created_by into v_old_chair,v_creator from public.meetings
  where id=p_meeting_id and status not in ('ended','cancelled') for update;
  if not found then raise exception 'Meeting not found or already finished.'; end if;
  if v_uid <> v_creator and (v_uid <> v_old_chair or not private.is_meeting_member(p_meeting_id,v_uid)) then
    raise exception 'Only the current active chair or meeting host can transfer the chair.';
  end if;
  if p_new_chair_id = v_old_chair then return; end if;
  if not exists (
    select 1 from public.meeting_participants
    where meeting_id=p_meeting_id and user_id=p_new_chair_id and left_at is null
  ) then
    raise exception 'The new chair must be an active participant.';
  end if;
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

create or replace function public.update_meeting_status(p_meeting_id uuid, p_status text)
returns void language plpgsql security definer
set search_path = ''
as $$
declare v_uid uuid := auth.uid(); v_owner uuid; v_chair uuid; v_status text;
begin
  if v_uid is null then raise exception 'Sign in required.'; end if;
  if p_status not in ('live','ended','cancelled') then raise exception 'Unsupported meeting status.'; end if;
  select created_by,chair_user_id,status into v_owner,v_chair,v_status
  from public.meetings where id=p_meeting_id for update;
  if not found then raise exception 'Meeting not found.'; end if;
  if v_uid <> v_owner and (v_uid <> v_chair or not private.is_meeting_member(p_meeting_id,v_uid)) then
    raise exception 'Only the host or active chair can change meeting status.';
  end if;
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
