-- Tighten private translation support tables and index referenced keys.
-- Explicit deny policies document that these tables are server-only.
drop policy if exists translation_cache_deny_client on public.translation_cache;
create policy translation_cache_deny_client on public.translation_cache
  for all to anon, authenticated using (false) with check (false);
drop policy if exists translation_usage_deny_client on public.translation_usage;
create policy translation_usage_deny_client on public.translation_usage
  for all to anon, authenticated using (false) with check (false);

create index if not exists translation_cache_target_locale_idx
  on public.translation_cache(target_locale);
create index if not exists translation_catalog_reviewed_by_idx
  on public.translation_catalog(reviewed_by);
create index if not exists call_signals_chat_id_idx
  on public.call_signals(chat_id);
create index if not exists call_signals_sender_id_idx
  on public.call_signals(sender_id);
