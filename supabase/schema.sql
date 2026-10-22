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

-- =========================================================
-- 5) اجعل حسابك مديرًا للمكتبة:
--    سجّل الدخول في الموقع مرة واحدة أولًا، ثم ضع بريدك مكان المثال ونفّذ السطر التالي وحده
--    (احذف علامتي -- من أوله قبل التنفيذ):
-- update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'your-email@example.com');
--
--    ولإضافة محرر (يضيف ويعدّل دون إدارة الصلاحيات): غيّر 'admin' إلى 'editor' وضع بريده.
-- =========================================================
