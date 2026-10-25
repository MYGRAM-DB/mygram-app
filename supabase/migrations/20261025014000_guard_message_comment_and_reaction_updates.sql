create or replace function public.guard_direct_message_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null or old.recipient_id <> auth.uid() then
    raise exception 'Only the recipient may mark a message as read';
  end if;
  if new.id is distinct from old.id
     or new.sender_id is distinct from old.sender_id
     or new.recipient_id is distinct from old.recipient_id
     or new.body is distinct from old.body
     or new.created_at is distinct from old.created_at then
    raise exception 'Direct message content and participants are immutable';
  end if;
  if old.read_at is not null and new.read_at is distinct from old.read_at then
    raise exception 'Read receipt cannot be cleared or rewritten';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_direct_message_update on public.direct_messages;
create trigger guard_direct_message_update
before update on public.direct_messages
for each row execute function public.guard_direct_message_update();

create or replace function public.guard_post_comment_integrity()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_post_id uuid;
begin
  if tg_op = 'UPDATE' then
    if new.id is distinct from old.id
       or new.post_id is distinct from old.post_id
       or new.user_id is distinct from old.user_id
       or new.parent_comment_id is distinct from old.parent_comment_id
       or new.created_at is distinct from old.created_at then
      raise exception 'Comment identity, author, parent, and post are immutable';
    end if;
  end if;

  if new.parent_comment_id is not null then
    select c.post_id into parent_post_id
    from public.post_comments c
    where c.id = new.parent_comment_id;
    if parent_post_id is null or parent_post_id <> new.post_id then
      raise exception 'Reply must belong to the same post as its parent comment';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_post_comment_integrity on public.post_comments;
create trigger guard_post_comment_integrity
before insert or update on public.post_comments
for each row execute function public.guard_post_comment_integrity();

create or replace function public.guard_post_reaction_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.post_id is distinct from old.post_id
     or new.user_id is distinct from old.user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Reaction identity, post, and owner are immutable';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_post_reaction_update on public.post_reactions;
create trigger guard_post_reaction_update
before update on public.post_reactions
for each row execute function public.guard_post_reaction_update();
