-- مساحة الفريق الإدارية (ب2-69 … ب2-85 من وثيقة التطوير). آمن عند إعادة التنفيذ.
-- لا تظهر إلا للمدير وأعضاء الفريق (editor/admin). الصلاحيات الدقيقة في profiles.team_perms ويمنحها المدير وحده.
-- المحادثة الخاصة: members غير فارغ ⇒ لا يراها إلا المذكورون فيه (ولا المدير إن لم يكن منهم).

alter table public.profiles add column if not exists team_perms text[] not null default '{}';

-- عضو الفريق: محرر أو مدير. والصلاحية: المدير له كل شيء، والمحرر بما مُنح.
create or replace function public.team_can(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and (role = 'admin' or (role = 'editor' and p = any(team_perms))));
$$;

create table if not exists public.team_threads (
  id bigint generated always as identity primary key,
  kind text not null check (kind in ('chat','discussion','decision','review','meeting','task','note')),
  title text not null check (char_length(title) between 1 and 200),
  body text not null default '' check (char_length(body) <= 20000),
  section text,                       -- القسم أو الخدمة المعنية
  status text not null default 'open' check (status in ('open','doing','review','approved','rejected','done','closed')),
  assignee uuid references auth.users(id) on delete set null,
  due date,
  members uuid[],                     -- null: الفريق كله؛ وإلا محادثة خاصة بالمذكورين
  meta jsonb not null default '{}',   -- الاجتماع: at, link؛ القرار: impl؛ المراجعة: ref
  created_by uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists team_threads_upd on public.team_threads (updated_at desc);

create table if not exists public.team_posts (
  id bigint generated always as identity primary key,
  thread_id bigint not null references public.team_threads(id) on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 20000),
  file text,                          -- مسار في الحاوية الخاصة team
  created_at timestamptz not null default now()
);
create index if not exists team_posts_thread on public.team_posts (thread_id, created_at);

-- سجل القرارات والتعديلات الإدارية (لا يُعدَّل ولا يُحذف من الواجهة)
create table if not exists public.team_audit (
  id bigint generated always as identity primary key,
  actor uuid default auth.uid(),
  action text not null,
  target text,
  detail jsonb not null default '{}',
  at timestamptz not null default now()
);

create or replace function public.team_sees(t public.team_threads) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() and (t.members is null or auth.uid() = any(t.members));
$$;

alter table public.team_threads enable row level security;
alter table public.team_posts enable row level security;
alter table public.team_audit enable row level security;

drop policy if exists "team threads read" on public.team_threads;
create policy "team threads read" on public.team_threads for select using (public.team_sees(team_threads));
drop policy if exists "team threads insert" on public.team_threads;
create policy "team threads insert" on public.team_threads for insert with check (public.is_staff() and created_by = auth.uid() and (members is null or auth.uid() = any(members)));
drop policy if exists "team threads update" on public.team_threads;
create policy "team threads update" on public.team_threads for update using (public.team_sees(team_threads) and (created_by = auth.uid() or assignee = auth.uid() or public.is_admin()))
  with check (public.is_staff());
drop policy if exists "team threads delete" on public.team_threads;
create policy "team threads delete" on public.team_threads for delete using (public.is_admin() and public.team_sees(team_threads));

drop policy if exists "team posts read" on public.team_posts;
create policy "team posts read" on public.team_posts for select using (exists (select 1 from public.team_threads t where t.id = thread_id and public.team_sees(t)));
drop policy if exists "team posts insert" on public.team_posts;
create policy "team posts insert" on public.team_posts for insert with check (user_id = auth.uid() and exists (select 1 from public.team_threads t where t.id = thread_id and public.team_sees(t)));
drop policy if exists "team posts delete" on public.team_posts;
create policy "team posts delete" on public.team_posts for delete using (user_id = auth.uid() or public.is_admin());

drop policy if exists "team audit read" on public.team_audit;
create policy "team audit read" on public.team_audit for select using (public.is_staff());
drop policy if exists "team audit insert" on public.team_audit;
create policy "team audit insert" on public.team_audit for insert with check (public.is_staff() and actor = auth.uid());

-- تحديث وقت النقاش عند الرد، وإشعارات الفريق الداخلية (جرس الإشعارات)
create or replace function public.team_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare t public.team_threads; who text; ttl text; txt text;
begin
  if tg_table_name = 'team_posts' then
    select * into t from public.team_threads where id = new.thread_id;
    update public.team_threads set updated_at = now() where id = new.thread_id;
    txt := left(new.body, 140);
  else
    t := new; txt := left(new.body, 140);
  end if;
  select coalesce(name, 'عضو الفريق') into who from public.profiles where id = auth.uid();
  ttl := case when tg_table_name = 'team_posts' then 'رد في «' || t.title || '»'
              when t.kind = 'task' then 'مهمة جديدة: ' || t.title
              when t.kind = 'meeting' then 'اجتماع: ' || t.title
              when t.kind = 'review' then 'طلب مراجعة: ' || t.title
              when t.kind = 'decision' then 'قرار: ' || t.title
              else 'في مساحة الفريق: ' || t.title end;
  insert into public.notifications (user_id, title, body, url)
    select p.id, ttl, who || ': ' || coalesce(txt, ''), '#/team/' || t.id
    from public.profiles p
    where p.role in ('editor','admin') and p.id <> coalesce(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid)
      and (t.members is null or p.id = any(t.members));
  return new;
end $$;
drop trigger if exists team_threads_notify on public.team_threads;
create trigger team_threads_notify after insert on public.team_threads for each row execute function public.team_notify();
drop trigger if exists team_posts_notify on public.team_posts;
create trigger team_posts_notify after insert on public.team_posts for each row execute function public.team_notify();

-- تغيير الصلاحيات يُسجَّل آليًا (ب2-83)
create or replace function public.team_perm_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role or new.team_perms is distinct from old.team_perms then
    insert into public.team_audit (actor, action, target, detail)
    values (auth.uid(), 'perms', new.id::text, jsonb_build_object('name', new.name, 'role', jsonb_build_array(old.role, new.role), 'perms', jsonb_build_array(old.team_perms, new.team_perms)));
  end if;
  return new;
end $$;
drop trigger if exists profiles_perm_audit on public.profiles;
create trigger profiles_perm_audit after update on public.profiles for each row execute function public.team_perm_audit();

-- حاوية خاصة لملفات الفريق
insert into storage.buckets (id, name, public) values ('team', 'team', false) on conflict (id) do nothing;
drop policy if exists "team files read" on storage.objects;
-- مسار الملف: <رقم النقاش>/<اسم>؛ لا يقرؤه إلا من يرى النقاش (فملفات المحادثة الخاصة خاصة)
create or replace function public.team_file_ok(path text) returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_staff() and split_part(path, '/', 1) ~ '^[0-9]{1,18}$'
    and exists (select 1 from public.team_threads t where t.id = split_part(path, '/', 1)::bigint and public.team_sees(t));
$$;
create policy "team files read" on storage.objects for select to authenticated using (bucket_id = 'team' and public.team_file_ok(name));
drop policy if exists "team files insert" on storage.objects;
create policy "team files insert" on storage.objects for insert to authenticated with check (bucket_id = 'team' and public.team_file_ok(name));
drop policy if exists "team files delete" on storage.objects;
create policy "team files delete" on storage.objects for delete to authenticated using (bucket_id = 'team' and public.is_admin());

revoke execute on function public.team_notify() from public, anon, authenticated;
revoke execute on function public.team_perm_audit() from public, anon, authenticated;
