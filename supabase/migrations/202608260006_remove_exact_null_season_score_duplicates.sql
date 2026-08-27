-- Remove only the ten audited null-season score rows that exactly duplicate a
-- canonical score in their member's four-digit season.
--
-- REMOTE GATES:
-- 1. Rerun both aggregate audits and confirm null_total = eligible = 10.
-- 2. Take and verify a protected export of the ten complete rows, including
--    IDs and timestamps. That export is the only lossless rollback source.
-- 3. Apply during a quiet write window. The table lock permits reads but blocks
--    concurrent score writes for this short transaction.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

lock table public.weekly_scores in share row exclusive mode;

do $$
declare
  deleted_count integer;
  eligible_count integer;
  null_count integer;
begin
  select count(*)
  into null_count
  from public.weekly_scores
  where season is null;

  select count(*)
  into eligible_count
  from public.weekly_scores candidate
  join public.league_members member
    on member.id = candidate.member_id
   and member.league_id = candidate.league_id
  where candidate.season is null
    and member.season ~ '^[0-9]{4}$'
    and (
      select count(*)
      from public.weekly_scores canonical
      where canonical.id <> candidate.id
        and canonical.league_id = candidate.league_id
        and canonical.member_id = candidate.member_id
        and canonical.week_number = candidate.week_number
        and canonical.season = member.season
        and canonical.points is not distinct from candidate.points
    ) = 1;

  if null_count <> eligible_count then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Null-season cleanup aborted: % rows exist but only % are exact eligible duplicates.',
        null_count,
        eligible_count
      );
  end if;

  if eligible_count not in (0, 10) then
    raise exception using
      errcode = 'P0001',
      message = format(
        'Null-season cleanup aborted: expected exactly 0 or the audited 10 candidates, found %.',
        eligible_count
      );
  end if;

  delete from public.weekly_scores candidate
  using public.league_members member
  where candidate.season is null
    and member.id = candidate.member_id
    and member.league_id = candidate.league_id
    and member.season ~ '^[0-9]{4}$'
    and (
      select count(*)
      from public.weekly_scores canonical
      where canonical.id <> candidate.id
        and canonical.league_id = candidate.league_id
        and canonical.member_id = candidate.member_id
        and canonical.week_number = candidate.week_number
        and canonical.season = member.season
        and canonical.points is not distinct from candidate.points
    ) = 1;

  get diagnostics deleted_count = row_count;
  if deleted_count <> eligible_count then
    raise exception 'Null-season cleanup deleted %, expected %.', deleted_count, eligible_count;
  end if;

  if exists (select 1 from public.weekly_scores where season is null) then
    raise exception 'Null-season cleanup left a null season score.';
  end if;
end;
$$;

commit;
