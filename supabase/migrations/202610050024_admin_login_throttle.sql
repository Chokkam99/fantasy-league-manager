-- Throttle commissioner sign-in attempts across every server instance.
--
-- There is one shared commissioner password and every attempt runs scrypt, so
-- unlimited attempts allow both password guessing and cheap compute abuse.
-- The route checks this lock before verifying a password, records each wrong
-- password, and clears the record on success. Clients are identified only by
-- a keyed hash of their IP address; raw addresses are never stored.
--
-- Rollback: drop the three functions and public.admin_login_attempts. The
-- route fails open (logs a warning) when the functions are missing.

begin;

set local lock_timeout = '5s';
set local statement_timeout = '2min';

create table if not exists public.admin_login_attempts (
  client_key text primary key
    check (client_key ~ '^[0-9a-f]{64}$'),
  failure_count integer not null default 0
    check (failure_count >= 0),
  window_started_at timestamptz not null default now(),
  locked_until timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.admin_login_attempts enable row level security;
revoke all privileges on table public.admin_login_attempts
  from public, anon, authenticated;

create or replace function public.check_admin_login_throttle(p_client_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  locked_until_value timestamptz;
begin
  select attempt.locked_until into locked_until_value
  from public.admin_login_attempts attempt
  where attempt.client_key = p_client_key;

  if locked_until_value is not null and locked_until_value > now() then
    return jsonb_build_object(
      'allowed', false,
      'retry_after_seconds', ceil(extract(epoch from locked_until_value - now()))::integer
    );
  end if;

  return jsonb_build_object('allowed', true, 'retry_after_seconds', 0);
end;
$$;

-- Five wrong passwords within 15 minutes lock that client out for 15 minutes.
create or replace function public.record_admin_login_failure(p_client_key text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  attempt_row public.admin_login_attempts%rowtype;
  max_failures constant integer := 5;
  failure_window constant interval := interval '15 minutes';
  lockout constant interval := interval '15 minutes';
begin
  if p_client_key is null or p_client_key !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = '22023', message = 'A hashed client key is required.';
  end if;

  delete from public.admin_login_attempts
  where updated_at < now() - interval '1 day';

  insert into public.admin_login_attempts as attempt (client_key, failure_count)
  values (p_client_key, 1)
  on conflict (client_key) do update
  set
    failure_count = case
      when attempt.window_started_at < now() - failure_window then 1
      else attempt.failure_count + 1
    end,
    window_started_at = case
      when attempt.window_started_at < now() - failure_window then now()
      else attempt.window_started_at
    end,
    locked_until = case
      when attempt.locked_until > now() then attempt.locked_until
      else null
    end,
    updated_at = now()
  returning * into attempt_row;

  if attempt_row.failure_count >= max_failures and attempt_row.locked_until is null then
    update public.admin_login_attempts
    set locked_until = now() + lockout, failure_count = 0, window_started_at = now()
    where client_key = p_client_key
    returning * into attempt_row;
  end if;

  return jsonb_build_object(
    'locked', attempt_row.locked_until is not null and attempt_row.locked_until > now(),
    'retry_after_seconds', coalesce(
      ceil(extract(epoch from attempt_row.locked_until - now()))::integer, 0
    )
  );
end;
$$;

create or replace function public.clear_admin_login_failures(p_client_key text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.admin_login_attempts where client_key = p_client_key;
$$;

revoke all on function public.check_admin_login_throttle(text) from public, anon, authenticated;
revoke all on function public.record_admin_login_failure(text) from public, anon, authenticated;
revoke all on function public.clear_admin_login_failures(text) from public, anon, authenticated;
grant execute on function public.check_admin_login_throttle(text) to service_role;
grant execute on function public.record_admin_login_failure(text) to service_role;
grant execute on function public.clear_admin_login_failures(text) to service_role;

commit;
