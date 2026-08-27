\set ON_ERROR_STOP on

set role service_role;

do $$
begin
  begin
    perform public.mutate_manual_week_atomically(
      'clear_week',
      'manual-week-lock-fixture',
      '2026',
      4,
      '[]'::jsonb
    );
    raise exception 'Concurrent manual score mutation unexpectedly acquired the ESPN week lock.';
  exception when lock_not_available then
    null;
  end;
end;
$$;

select 'MANUAL_WEEK_LOCKED';

reset role;
