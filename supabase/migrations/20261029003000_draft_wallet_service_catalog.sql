-- DRAFT ONLY. Depends on 20261029000000_draft_wallets_ledger_and_import_schema.sql.
-- Catalog is intentionally disabled until prices, taxes/refunds, and accounting treatment are approved.
-- No user is charged by this migration. Prices are stored as integer atomic units, never floats.

begin;

create table if not exists public.wallet_service_catalog (
  service_code text primary key,
  display_name text not null,
  category text not null check (category in ('game','ai','developer_tool','profile','cosmetic')),
  description text not null,
  price_asset_code text references public.wallet_assets(code),
  price_atomic numeric(38,0) check (price_atomic is null or price_atomic >= 0),
  burn_basis_points integer not null default 1000 check (burn_basis_points between 0 and 10000),
  enabled boolean not null default false,
  requires_explicit_confirmation boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (enabled = false or (price_asset_code is not null and price_atomic is not null and price_atomic > 0))
);

alter table public.wallet_service_catalog enable row level security;
drop policy if exists wallet_service_catalog_read_enabled on public.wallet_service_catalog;
create policy wallet_service_catalog_read_enabled
  on public.wallet_service_catalog for select to authenticated using (enabled = true);
revoke insert, update, delete on public.wallet_service_catalog from anon, authenticated;

insert into public.wallet_service_catalog
(service_code,display_name,category,description,price_asset_code,price_atomic,burn_basis_points,enabled,requires_explicit_confirmation)
values
('game_farm_round','Farm game: complete a round','game','Optional in-game round completion. Price shown before purchase.',null,null,1000,false,true),
('game_farm_speedup','Farm game: speed up timer','game','Optional timer acceleration. Price shown before purchase.',null,null,1000,false,true),
('game_daily_challenge','Daily challenge entry','game','Optional entry to a daily challenge.',null,null,1000,false,true),
('game_extra_life','Extra life','game','Optional extra life for a game session.',null,null,1000,false,true),
('game_cosmetic_pack','Game cosmetic pack','game','Optional decorative game items.',null,null,1000,false,true),
('game_reward_boost','Reward boost','game','Optional disclosed reward multiplier where game rules permit.',null,null,1000,false,true),
('game_puzzle_hint','Puzzle hint','game','Optional hint for a puzzle.',null,null,1000,false,true),
('game_tournament_entry','Tournament entry','game','Optional tournament entry with rules displayed.',null,null,1000,false,true),
('game_avatar_item','Game avatar item','game','Optional avatar decoration.',null,null,1000,false,true),
('game_extra_slot','Extra game save slot','game','Optional additional save slot.',null,null,1000,false,true),
('ai_text_summary','AI text summary','ai','Generate a summary of user-provided text.',null,null,1000,false,true),
('ai_translation','AI translation','ai','Translate user-provided text into a selected language.',null,null,1000,false,true),
('ai_image_generation','AI image generation','ai','Generate an image from an approved prompt.',null,null,1000,false,true),
('ai_voice_transcription','AI voice transcription','ai','Transcribe user-provided audio.',null,null,1000,false,true),
('ai_voice_generation','AI voice generation','ai','Generate speech from user-provided text.',null,null,1000,false,true),
('ai_writing_assistant','AI writing assistant','ai','Assist with drafting or rewriting text.',null,null,1000,false,true),
('ai_code_explanation','AI code explanation','ai','Explain user-provided code.',null,null,1000,false,true),
('ai_data_analysis','AI data analysis','ai','Analyze a user-provided dataset.',null,null,1000,false,true),
('ai_background_removal','AI background removal','ai','Remove the background from a user-provided image.',null,null,1000,false,true),
('ai_content_ideas','AI content ideas','ai','Generate ideas for user content.',null,null,1000,false,true),
('dev_code_review','Developer tool: code review','developer_tool','Review code and suggest improvements.',null,null,1000,false,true),
('dev_test_generation','Developer tool: generate tests','developer_tool','Generate draft tests for user-provided code.',null,null,1000,false,true),
('dev_api_documentation','Developer tool: API documentation','developer_tool','Draft API documentation.',null,null,1000,false,true),
('dev_debug_assistant','Developer tool: debugging assistant','developer_tool','Help diagnose user-provided errors.',null,null,1000,false,true),
('dev_sql_helper','Developer tool: SQL helper','developer_tool','Draft SQL queries with safety review reminders.',null,null,1000,false,true),
('profile_verified_badge','Profile verification badge','profile','Optional paid badge only if eligibility and meaning are clearly disclosed; not proof of identity by itself.',null,null,1000,false,true),
('profile_highlight','Profile highlight','profile','Optional time-limited profile highlight.',null,null,1000,false,true),
('profile_custom_theme','Profile theme','cosmetic','Optional profile theme.',null,null,1000,false,true),
('profile_animated_badge','Animated profile badge','cosmetic','Optional decorative animated badge.',null,null,1000,false,true),
('profile_name_effect','Display-name effect','cosmetic','Optional visual display-name effect.',null,null,1000,false,true)
on conflict (service_code) do nothing;

commit;
