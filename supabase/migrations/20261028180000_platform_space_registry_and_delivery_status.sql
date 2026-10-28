-- MYGRAM phase 1: platform space registry and honest delivery status.
-- Additive only: preserves existing accounts, content, and legacy tables.
create table if not exists public.platform_spaces (
  slug text primary key check (slug in ('ai','fb','insta','messenger','whatsmygram','twitty','tube','tiktoks','meeting')),
  display_name text not null,
  description text not null default '',
  sort_order smallint not null unique check (sort_order between 1 and 9),
  status text not null default 'in_progress' check (status in ('planned','in_progress','available','integration_required')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.platform_spaces enable row level security;
drop policy if exists "Authenticated users can read platform spaces" on public.platform_spaces;
create policy "Authenticated users can read platform spaces" on public.platform_spaces for select to authenticated using (true);
revoke all on public.platform_spaces from anon, authenticated;
grant select on public.platform_spaces to authenticated;

insert into public.platform_spaces (slug, display_name, description, sort_order, status) values
 ('ai','MYGRAM AI','AI tools and assisted creation; provider integrations may be required.',1,'integration_required'),
 ('fb','MYGRAM Social','Social feed, posts, comments, reactions, and communities.',2,'in_progress'),
 ('insta','MYGRAM Insta','Profiles, stories, photos, and creator content.',3,'in_progress'),
 ('messenger','MYGRAM Messenger','Independent private messaging and media.',4,'in_progress'),
 ('whatsmygram','WHATSMYGRAM','Separate private/group chat and call signaling.',5,'in_progress'),
 ('twitty','MYGRAM Twitty','Short text posts and conversations.',6,'planned'),
 ('tube','MYGRAM Tube','Long-form video publishing and playback.',7,'planned'),
 ('tiktoks','MYGRAM TikToks','Short-form vertical video feed.',8,'in_progress'),
 ('meeting','MYGRAM Meeting','Meeting rooms, participant management, and signaling.',9,'in_progress')
on conflict (slug) do update set display_name=excluded.display_name, description=excluded.description, sort_order=excluded.sort_order, status=excluded.status, updated_at=now();

create table if not exists public.platform_feature_registry (
  feature_key text primary key check (feature_key ~ '^[a-z0-9_.-]{3,100}$'),
  space_slug text not null references public.platform_spaces(slug) on update cascade on delete restrict,
  title text not null,
  implementation_status text not null check (implementation_status in ('planned','in_progress','implemented_unverified','verified','integration_required','blocked')),
  verification_note text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.platform_feature_registry enable row level security;
drop policy if exists "Authenticated users can read feature registry" on public.platform_feature_registry;
create policy "Authenticated users can read feature registry" on public.platform_feature_registry for select to authenticated using (true);
revoke all on public.platform_feature_registry from anon, authenticated;
grant select on public.platform_feature_registry to authenticated;

insert into public.platform_feature_registry(feature_key,space_slug,title,implementation_status,verification_note) values
 ('auth.email','fb','Email authentication','implemented_unverified','Provider and redirect/SMTP settings require live end-to-end verification.'),
 ('auth.phone_otp','fb','Phone OTP authentication','integration_required','Requires enabled phone provider, SMS provider credentials, and real OTP test.'),
 ('social.feed','fb','Feed posts and media','implemented_unverified','Existing tables and UI exist; end-to-end and RLS isolation tests remain.'),
 ('social.comments','fb','Comments','implemented_unverified','Existing tables and UI exist; permissions and live tests remain.'),
 ('social.reactions','fb','Post reactions','implemented_unverified','Existing tables and UI exist; live two-user verification remains.'),
 ('social.stories','insta','Stories','implemented_unverified','Existing schema and UI need live upload/expiry verification.'),
 ('social.reels','tiktoks','Short video reels','implemented_unverified','Existing schema and UI need upload/playback verification.'),
 ('messenger.direct','messenger','Direct messaging','implemented_unverified','Existing schema and UI; recipient search and two-account tests remain.'),
 ('whatsmygram.chat','whatsmygram','Independent chat','implemented_unverified','Existing schema; full client behavior requires end-to-end verification.'),
 ('meeting.signaling','meeting','Meeting signaling','implemented_unverified','Signaling schema exists; browser/device call verification remains.'),
 ('i18n.full_60','fb','Complete 60-language interface','in_progress','Current repository documents 47 core strings per locale; complete coverage is not yet verified.'),
 ('countries.205','fb','205-country registration catalog','implemented_unverified','Catalog support exists; count and full country/nationality integration need verification.')
on conflict (feature_key) do update set space_slug=excluded.space_slug, title=excluded.title, implementation_status=excluded.implementation_status, verification_note=excluded.verification_note, updated_at=now();
create index if not exists platform_feature_registry_space_idx on public.platform_feature_registry(space_slug);
