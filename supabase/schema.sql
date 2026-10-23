-- =========================================================
-- مكتبة الدعوة السلفية الرقمية — قاعدة البيانات (Supabase)
-- نفّذ هذا الملف كاملًا مرة واحدة: Supabase ← SQL Editor ← New query ← الصق ← Run
-- يمكن تنفيذه مرة أخرى بأمان بعد أي تحديث للملف.
-- =========================================================

-- 1) الملفات الشخصية والصلاحيات (member عضو، editor محرر، admin مدير)
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text,
  role text not null default 'member' check (role in ('member','editor','admin')),
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role in ('editor','admin'));
$$;
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

drop policy if exists "profiles read" on public.profiles;
create policy "profiles read" on public.profiles for select using (id = auth.uid() or public.is_staff());
drop policy if exists "profiles admin update" on public.profiles;
create policy "profiles admin update" on public.profiles for update using (public.is_admin()) with check (public.is_admin());

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name', new.email))
  on conflict (id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
-- دوال المشغّلات تعمل تلقائيًا فقط، فلا يُسمح باستدعائها مباشرة عبر الواجهة
revoke execute on function public.handle_new_user() from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
             where n.nspname = 'public' and p.proname = 'rls_auto_enable') then
    execute 'revoke execute on function public.rls_auto_enable() from public, anon, authenticated';
  end if;
end $$;
insert into public.profiles (id, name)
  select id, coalesce(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', email) from auth.users
  on conflict (id) do nothing;

-- 2) محادثات «اسأل المكتبة»
create table if not exists public.conversations (
  id text primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text, messages jsonb, mode text, col text,
  updated_at timestamptz default now()
);
alter table public.conversations enable row level security;
drop policy if exists "own conversations" on public.conversations;
create policy "own conversations" on public.conversations for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- 3) تصحيحات يقترحها القراء
create table if not exists public.corrections (
  id bigserial primary key,
  book_id text not null, page int not null,
  proposed text not null check (length(proposed) < 60000), note text,
  user_id uuid not null default auth.uid() references auth.users on delete cascade, user_name text,
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  created_at timestamptz not null default now()
);
alter table public.corrections enable row level security;
drop policy if exists "corrections insert own" on public.corrections;
create policy "corrections insert own" on public.corrections for insert with check (auth.uid() = user_id and status = 'pending');
drop policy if exists "corrections read" on public.corrections;
create policy "corrections read" on public.corrections for select using (user_id = auth.uid() or public.is_staff());
drop policy if exists "corrections staff update" on public.corrections;
create policy "corrections staff update" on public.corrections for update using (public.is_staff());

-- 4) التفاعل مع المنشورات
-- المنشورات نفسها في data/posts.json؛ وهنا تفاعل الأعضاء معها (معرّف المنشور نصي)
create table if not exists public.post_reactions (
  post_id text not null,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_reactions enable row level security;
drop policy if exists "reactions read" on public.post_reactions;
create policy "reactions read" on public.post_reactions for select using (true);
drop policy if exists "reactions own insert" on public.post_reactions;
create policy "reactions own insert" on public.post_reactions for insert with check (auth.uid() = user_id);
drop policy if exists "reactions own delete" on public.post_reactions;
create policy "reactions own delete" on public.post_reactions for delete using (auth.uid() = user_id);

create table if not exists public.post_saves (
  post_id text not null,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_saves enable row level security;
drop policy if exists "saves own" on public.post_saves;
create policy "saves own" on public.post_saves for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.post_comments (
  id bigserial primary key,
  post_id text not null,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  user_name text,
  body text not null check (length(body) between 1 and 2000),
  created_at timestamptz not null default now()
);
alter table public.post_comments enable row level security;
drop policy if exists "comments read" on public.post_comments;
create policy "comments read" on public.post_comments for select using (true);
drop policy if exists "comments own insert" on public.post_comments;
create policy "comments own insert" on public.post_comments for insert with check (auth.uid() = user_id);
drop policy if exists "comments delete" on public.post_comments;
create policy "comments delete" on public.post_comments for delete using (auth.uid() = user_id or public.is_staff());
create index if not exists post_comments_post on public.post_comments (post_id, created_at);

create or replace view public.post_stats with (security_invoker = true) as
  select post_id, sum(l)::int as likes, sum(c)::int as comments from (
    select post_id, 1 as l, 0 as c from public.post_reactions
    union all
    select post_id, 0, 1 from public.post_comments
  ) x group by post_id;
grant select on public.post_stats to anon, authenticated;


-- 6) مكتبتي الشخصية: علامة الصفحة، والتعليقات الخاصة، ومشاريع القراءة، والإشعارات
-- علامة واحدة لكل كتاب تبقى حتى ينقلها القارئ إلى صفحة أخرى
create table if not exists public.bookmarks (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  book_id text not null, page int not null, title text,
  updated_at timestamptz not null default now(),
  primary key (user_id, book_id)
);
alter table public.bookmarks enable row level security;
drop policy if exists "bookmarks own" on public.bookmarks;
create policy "bookmarks own" on public.bookmarks for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- تعليقات القارئ وتظليله الخاص (لا يراها غيره)
create table if not exists public.notes (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  book_id text not null, page int not null, title text,
  quote text not null check (length(quote) between 1 and 3000),
  note text check (length(note) < 5000),
  color text not null default 'y',
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
alter table public.notes enable row level security;
drop policy if exists "notes own" on public.notes;
create policy "notes own" on public.notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index if not exists notes_user_book on public.notes (user_id, book_id);

-- مشاريع القراءة (ورد يومي وتذكير)
create table if not exists public.reading_plans (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  book_id text not null, title text,
  daily int not null default 10 check (daily between 1 and 500),
  remind_at text default '20:00', tz_offset int not null default 180, hour_utc int,
  start_page int not null default 1, last_page int, start_date date not null default current_date,
  last_read timestamptz, last_sent date, active boolean not null default true,
  created_at timestamptz not null default now(),
  primary key (user_id, book_id)
);
alter table public.reading_plans enable row level security;
drop policy if exists "plans own" on public.reading_plans;
create policy "plans own" on public.reading_plans for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- إشعارات العضو (تذكير الورد وغيره)
create table if not exists public.notifications (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  title text not null, body text, url text, read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
drop policy if exists "notifications own read" on public.notifications;
create policy "notifications own read" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "notifications own update" on public.notifications;
create policy "notifications own update" on public.notifications for update using (auth.uid() = user_id);
drop policy if exists "notifications own delete" on public.notifications;
create policy "notifications own delete" on public.notifications for delete using (auth.uid() = user_id);

-- إشعارات عامة يرسلها المشرف لكل الأعضاء
create table if not exists public.broadcasts (
  id bigserial primary key,
  title text not null check (length(title) between 1 and 200), body text, url text,
  pushed boolean not null default false,
  created_by uuid default auth.uid(), created_at timestamptz not null default now()
);
alter table public.broadcasts enable row level security;
drop policy if exists "broadcasts read" on public.broadcasts;
create policy "broadcasts read" on public.broadcasts for select using (true);
drop policy if exists "broadcasts staff" on public.broadcasts;
create policy "broadcasts staff" on public.broadcasts for insert with check (public.is_staff());
drop policy if exists "broadcasts staff delete" on public.broadcasts;
create policy "broadcasts staff delete" on public.broadcasts for delete using (public.is_staff());

-- اشتراكات إشعارات الجهاز (Web Push)
create table if not exists public.push_subs (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  p256dh text not null, auth text not null, ua text,
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
drop policy if exists "push own" on public.push_subs;
create policy "push own" on public.push_subs for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =========================================================
-- 5) اجعل حسابك مديرًا للمكتبة:
--    سجّل الدخول في الموقع مرة واحدة أولًا، ثم ضع بريدك مكان المثال ونفّذ السطر التالي وحده
--    (احذف علامتي -- من أوله قبل التنفيذ):
-- update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'your-email@example.com');
--
--    ولإضافة محرر (يضيف ويعدّل دون إدارة الصلاحيات): غيّر 'admin' إلى 'editor' وضع بريده.
-- =========================================================
