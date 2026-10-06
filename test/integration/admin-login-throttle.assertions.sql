-- Five wrong passwords in 15 minutes lock one client for 15 minutes; success
-- clears the record; shared roles cannot read or call any of it.
\set ON_ERROR_STOP on
begin;
do $$
declare
 client constant text := repeat('a', 64);
 other_client constant text := repeat('b', 64);
 result jsonb; checked_role text; attempt integer;
begin
 foreach checked_role in array array['anon', 'authenticated'] loop
  if has_table_privilege(checked_role, 'public.admin_login_attempts', 'select')
    or has_function_privilege(checked_role, 'public.check_admin_login_throttle(text)', 'execute')
    or has_function_privilege(checked_role, 'public.record_admin_login_failure(text)', 'execute')
    or has_function_privilege(checked_role, 'public.clear_admin_login_failures(text)', 'execute') then
   raise exception '% can reach commissioner login throttling', checked_role;
  end if;
 end loop;

 for attempt in 1..4 loop
  result := public.record_admin_login_failure(client);
  if (result->>'locked')::boolean then raise exception 'Locked after only % failures: %', attempt, result; end if;
 end loop;
 if (public.check_admin_login_throttle(client)->>'allowed')::boolean is distinct from true then
  raise exception 'Four failures should not block sign-in.';
 end if;

 result := public.record_admin_login_failure(client);
 if (result->>'locked')::boolean is distinct from true or (result->>'retry_after_seconds')::integer not between 890 and 900 then
  raise exception 'The fifth failure did not lock the client for 15 minutes: %', result;
 end if;
 result := public.check_admin_login_throttle(client);
 if (result->>'allowed')::boolean is distinct from false or (result->>'retry_after_seconds')::integer < 890 then
  raise exception 'A locked client was allowed to try again: %', result;
 end if;
 if (public.check_admin_login_throttle(other_client)->>'allowed')::boolean is distinct from true then
  raise exception 'One client lockout blocked a different client.';
 end if;

 -- More failures during the lockout do not extend it indefinitely.
 perform public.record_admin_login_failure(client);
 if (select locked_until from public.admin_login_attempts where client_key = client) > now() + interval '15 minutes' then
  raise exception 'A failure during the lockout extended it.';
 end if;

 perform public.clear_admin_login_failures(client);
 if (public.check_admin_login_throttle(client)->>'allowed')::boolean is distinct from true
   or exists (select 1 from public.admin_login_attempts where client_key = client) then
  raise exception 'A successful sign-in did not clear the lockout.';
 end if;

 -- Failures older than the window start a new count.
 insert into public.admin_login_attempts (client_key, failure_count, window_started_at)
 values (other_client, 4, now() - interval '16 minutes');
 result := public.record_admin_login_failure(other_client);
 if (result->>'locked')::boolean or (select failure_count from public.admin_login_attempts where client_key = other_client) <> 1 then
  raise exception 'An expired failure window was not reset: %', result;
 end if;

 begin
  perform public.record_admin_login_failure('203.0.113.7');
  raise exception 'A raw IP address was accepted as a client key.';
 exception when invalid_parameter_value then null;
 end;
end;
$$;
rollback;
