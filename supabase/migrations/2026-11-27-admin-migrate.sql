-- Admin migration runner: lets the site owner (profiles.role = 'admin') apply a migration file from the site with one click.
-- Safe to re-run. ASCII only on purpose (pasting Arabic into the SQL editor can corrupt text).
-- Guard rails: admin only, destructive statements rejected, every run logged in public.migration_log.
create table if not exists public.migration_log (
  id bigserial primary key,
  name text not null,
  ok boolean not null,
  error text,
  by_user uuid default auth.uid(),
  at timestamptz not null default now()
);
alter table public.migration_log enable row level security;
drop policy if exists "migration_log admin read" on public.migration_log;
create policy "migration_log admin read" on public.migration_log for select using (public.is_admin());

create or replace function public.admin_run_migration(p_name text, p_sql text) returns jsonb
language plpgsql security definer set search_path = public, auth as $fn$
declare low text;
begin
  if not public.is_admin() then
    raise exception 'admin only' using errcode = '42501';
  end if;
  if p_name is null or p_name !~ '^[A-Za-z0-9._-]{3,80}\.sql$' then
    raise exception 'bad migration name';
  end if;
  low := lower(coalesce(p_sql, ''));
  if length(low) < 10 or length(low) > 200000 then
    raise exception 'bad migration size';
  end if;
  if low ~ '(drop\s+table|drop\s+schema|drop\s+database|truncate|delete\s+from|alter\s+role|create\s+role|drop\s+role|drop\s+owned|alter\s+system|copy\s+|pg_read_|pg_ls_dir|lo_import|lo_export|create\s+extension|set\s+role|set\s+session|reset\s+role)' then
    insert into public.migration_log(name, ok, error) values (p_name, false, 'rejected: destructive statement');
    raise exception 'destructive statement rejected';
  end if;
  begin
    execute p_sql;
  exception when others then
    insert into public.migration_log(name, ok, error) values (p_name, false, left(sqlerrm, 500));
    return jsonb_build_object('ok', false, 'error', sqlerrm);
  end;
  insert into public.migration_log(name, ok) values (p_name, true);
  return jsonb_build_object('ok', true);
end
$fn$;
revoke all on function public.admin_run_migration(text, text) from public, anon;
grant execute on function public.admin_run_migration(text, text) to authenticated;
