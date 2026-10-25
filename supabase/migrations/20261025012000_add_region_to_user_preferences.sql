alter table public.user_preferences add column if not exists region text check (region is null or char_length(btrim(region)) between 1 and 100);
