-- OPT-IN ONLY. Do not apply automatically. Staging-only cron registration for daily airdrop decay.
-- The job is intentionally not registered unless an operator explicitly sets:
--   SET mygram.enable_airdrop_decay_cron = 'on';
-- It requires pg_cron to be installed and the migration runner to have permission to schedule jobs.
-- Keep wallet_airdrop_decay_policy.enabled=false until the business rate and launch are approved.
begin;

do $$
begin
  if current_setting('mygram.enable_airdrop_decay_cron', true) is distinct from 'on' then
    raise exception 'cron registration blocked: explicitly SET mygram.enable_airdrop_decay_cron = on in staging';
  end if;

  if not exists (select 1 from pg_extension where extname = 'pg_cron') then
    raise exception 'cron registration blocked: pg_cron extension is not installed';
  end if;

  if to_regprocedure('wallet_private.process_daily_airdrop_decay()') is null then
    raise exception 'cron registration blocked: wallet_private.process_daily_airdrop_decay() is missing';
  end if;

  if not has_function_privilege(current_user, 'wallet_private.process_daily_airdrop_decay()', 'EXECUTE') then
    raise exception 'cron registration blocked: current scheduler role cannot execute the decay function';
  end if;

  -- Replace any prior job with the same stable name, then schedule daily at 02:17 UTC.
  perform cron.unschedule(jobid)
    from cron.job
   where jobname = 'mygram-airdrop-decay-daily';

  perform cron.schedule(
    'mygram-airdrop-decay-daily',
    '17 2 * * *',
    'select wallet_private.process_daily_airdrop_decay();'
  );
end;
$$;

commit;
