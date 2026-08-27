-- Normalize only the 24 audited completed/not-final legacy scores. Points,
-- weeks, seasons, playoff flags, and timestamps remain unchanged.
--
-- REMOTE GATES:
-- 1. Confirm completed_not_final = 24 and final_not_completed = 0.
-- 2. Export the affected IDs and original lifecycle fields for rollback.
-- 3. Apply during a quiet score-write window.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

lock table public.weekly_scores in share row exclusive mode;

do $$
declare
  candidate_count integer;
  inverse_count integer;
  updated_count integer;
begin
  select count(*)
  into candidate_count
  from public.weekly_scores
  where week_status = 'completed'
    and is_final_score is distinct from true;

  select count(*)
  into inverse_count
  from public.weekly_scores
  where is_final_score is true
    and week_status is distinct from 'completed';

  if inverse_count <> 0 then
    raise exception 'Lifecycle cleanup aborted: found % final/not-completed rows.', inverse_count;
  end if;

  if candidate_count not in (0, 24) then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Lifecycle cleanup aborted: expected exactly 0 or the audited 24 candidates, found %.',
        candidate_count
      );
  end if;

  update public.weekly_scores
  set is_final_score = true
  where week_status = 'completed'
    and is_final_score is distinct from true;

  get diagnostics updated_count = row_count;
  if updated_count <> candidate_count then
    raise exception 'Lifecycle cleanup updated %, expected %.', updated_count, candidate_count;
  end if;

  if exists (
    select 1
    from public.weekly_scores
    where (week_status = 'completed') is distinct from is_final_score
  ) then
    raise exception 'Lifecycle cleanup left inconsistent score status.';
  end if;
end;
$$;

commit;
