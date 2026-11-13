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
create policy "profiles read" on public.profiles for select using (id = (select auth.uid()) or public.is_staff());
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
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

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
create policy "corrections insert own" on public.corrections for insert with check ((select auth.uid()) = user_id and status = 'pending');
drop policy if exists "corrections read" on public.corrections;
create policy "corrections read" on public.corrections for select using (user_id = (select auth.uid()) or public.is_staff());
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
create policy "reactions own insert" on public.post_reactions for insert with check ((select auth.uid()) = user_id);
drop policy if exists "reactions own delete" on public.post_reactions;
create policy "reactions own delete" on public.post_reactions for delete using ((select auth.uid()) = user_id);

create table if not exists public.post_saves (
  post_id text not null,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
alter table public.post_saves enable row level security;
drop policy if exists "saves own" on public.post_saves;
create policy "saves own" on public.post_saves for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

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
create policy "comments own insert" on public.post_comments for insert with check ((select auth.uid()) = user_id);
drop policy if exists "comments delete" on public.post_comments;
create policy "comments delete" on public.post_comments for delete using ((select auth.uid()) = user_id or public.is_staff());
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
create policy "bookmarks own" on public.bookmarks for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

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
-- دفتر الفوائد: نوع المدوَّنة (fa فائدة، q اقتباس، n ملاحظة، t مصطلح، s سؤال، m ملخص) ووسومها
alter table public.notes add column if not exists kind text not null default 'n';
alter table public.notes add column if not exists tags text[] not null default '{}';
create index if not exists notes_user_kind_idx on public.notes(user_id, kind);
alter table public.notes enable row level security;
drop policy if exists "notes own" on public.notes;
create policy "notes own" on public.notes for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
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
create policy "plans own" on public.reading_plans for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- إشعارات العضو (تذكير الورد وغيره)
create table if not exists public.notifications (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  title text not null, body text, url text, read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
drop policy if exists "notifications own read" on public.notifications;
create policy "notifications own read" on public.notifications for select using ((select auth.uid()) = user_id);
drop policy if exists "notifications own update" on public.notifications;
create policy "notifications own update" on public.notifications for update using ((select auth.uid()) = user_id);
drop policy if exists "notifications own delete" on public.notifications;
create policy "notifications own delete" on public.notifications for delete using ((select auth.uid()) = user_id);

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
create policy "push own" on public.push_subs for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- =========================================================
-- 5) اجعل حسابك مديرًا للمكتبة:
--    سجّل الدخول في الموقع مرة واحدة أولًا، ثم ضع بريدك مكان المثال ونفّذ السطر التالي وحده
--    (احذف علامتي -- من أوله قبل التنفيذ):
-- update public.profiles set role = 'admin' where id = (select id from auth.users where email = 'your-email@example.com');
--
--    ولإضافة محرر (يضيف ويعدّل دون إدارة الصلاحيات): غيّر 'admin' إلى 'editor' وضع بريده.
-- =========================================================

-- ===== الحلقة الاجتماعية: صفحات الأعضاء، والمتابعة، ومنشورات الأعضاء والاقتباس من الكتب، والردود =====
-- صفحة العضو العامة (منفصلة عن profiles حتى لا تُكشف الصلاحيات ولا تُعدَّل)
create table if not exists public.member_pages (
  user_id uuid primary key default auth.uid() references auth.users on delete cascade,
  name text not null check (length(name) between 2 and 60),
  bio text check (length(bio) <= 300),
  avatar_url text check (length(avatar_url) <= 500),
  updated_at timestamptz not null default now()
);
alter table public.member_pages enable row level security;
drop policy if exists "member pages read" on public.member_pages;
create policy "member pages read" on public.member_pages for select using (true);
drop policy if exists "member pages own insert" on public.member_pages;
create policy "member pages own insert" on public.member_pages for insert with check ((select auth.uid()) = user_id);
drop policy if exists "member pages own update" on public.member_pages;
create policy "member pages own update" on public.member_pages for update using ((select auth.uid()) = user_id);

-- المتابعة: followee = 'u:<معرف عضو>' أو 'a:<معرف مؤلف/شيخ>'
create table if not exists public.follows (
  follower uuid not null default auth.uid() references auth.users on delete cascade,
  followee text not null check (followee ~ '^(u|a):[A-Za-z0-9_-]{1,64}$'),
  created_at timestamptz not null default now(),
  primary key (follower, followee)
);
create index if not exists follows_followee on public.follows (followee);
alter table public.follows enable row level security;
drop policy if exists "follows read" on public.follows;
create policy "follows read" on public.follows for select using (true);
drop policy if exists "follows own insert" on public.follows;
create policy "follows own insert" on public.follows for insert with check ((select auth.uid()) = follower and followee <> 'u:' || (select auth.uid())::text);
drop policy if exists "follows own delete" on public.follows;
create policy "follows own delete" on public.follows for delete using ((select auth.uid()) = follower);

-- منشورات الأعضاء: «مختارات» من كتب المكتبة فقط، بلا كلام شخصي. معرّفها في التفاعل: 'm' || id
-- لا يكتب العضو في الجدول مباشرة: الخادم (api/mpost.js) يتحقق أن النص موجود في الكتاب ثم يكتب بمفتاح الخدمة.
create table if not exists public.member_posts (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  user_name text,
  body text not null default '' check (length(body) <= 5000),
  quote jsonb not null check (jsonb_typeof(quote) = 'object' and length(quote::text) <= 6000 and quote ? 'b' and quote ? 't'),
  created_at timestamptz not null default now(),
  check (body = '')
);
create index if not exists member_posts_user on public.member_posts (user_id, created_at desc);
create index if not exists member_posts_time on public.member_posts (created_at desc);
alter table public.member_posts enable row level security;
drop policy if exists "member posts read" on public.member_posts;
create policy "member posts read" on public.member_posts for select using (true);
drop policy if exists "member posts own insert" on public.member_posts;
drop policy if exists "member posts own update" on public.member_posts;
drop policy if exists "member posts delete" on public.member_posts;
create policy "member posts delete" on public.member_posts for delete using ((select auth.uid()) = user_id or public.is_staff());

-- الردود على التعليقات، والإعجاب بالتعليقات
alter table public.post_comments add column if not exists parent_id bigint references public.post_comments on delete cascade;
create index if not exists post_comments_post on public.post_comments (post_id, created_at);
create table if not exists public.comment_reactions (
  comment_id bigint not null references public.post_comments on delete cascade,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
alter table public.comment_reactions enable row level security;
drop policy if exists "comment reactions read" on public.comment_reactions;
create policy "comment reactions read" on public.comment_reactions for select using (true);
drop policy if exists "comment reactions own insert" on public.comment_reactions;
create policy "comment reactions own insert" on public.comment_reactions for insert with check ((select auth.uid()) = user_id);
drop policy if exists "comment reactions own delete" on public.comment_reactions;
create policy "comment reactions own delete" on public.comment_reactions for delete using ((select auth.uid()) = user_id);

-- إشعارات التفاعل: تعليق على منشورك، ورد على تعليقك، ومتابعة جديدة، وإعجاب بمنشورك
create or replace function public.social_notify() returns trigger
language plpgsql security definer set search_path = public as $$
declare owner uuid; who text; pid bigint;
begin
  who := coalesce((select name from public.member_pages where user_id = auth.uid()), 'عضو');
  if tg_table_name = 'post_comments' then
    if new.parent_id is not null then
      select user_id into owner from public.post_comments where id = new.parent_id;
      if owner is not null and owner <> new.user_id then
        insert into public.notifications(user_id, title, body, url) values (owner, who || ' ردّ على تعليقك', left(new.body, 140), '#/post/' || new.post_id);
      end if;
    end if;
    if new.post_id ~ '^m[0-9]+$' then
      pid := substr(new.post_id, 2)::bigint;
      select user_id into owner from public.member_posts where id = pid;
      if owner is not null and owner <> new.user_id then
        insert into public.notifications(user_id, title, body, url) values (owner, who || ' علّق على منشورك', left(new.body, 140), '#/post/' || new.post_id);
      end if;
    end if;
  elsif tg_table_name = 'post_reactions' then
    if new.post_id ~ '^m[0-9]+$' then
      pid := substr(new.post_id, 2)::bigint;
      select user_id into owner from public.member_posts where id = pid;
      if owner is not null and owner <> new.user_id then
        insert into public.notifications(user_id, title, url) values (owner, who || ' أعجبه منشورك', '#/post/' || new.post_id);
      end if;
    end if;
  elsif tg_table_name = 'follows' then
    if new.followee like 'u:%' then
      insert into public.notifications(user_id, title, url) values (substr(new.followee, 3)::uuid, who || ' بدأ متابعتك', '#/member/' || new.follower);
    end if;
  end if;
  return new;
exception when others then return new;  -- الإشعار لا يمنع التفاعل نفسه
end $$;
revoke execute on function public.social_notify() from public, anon, authenticated;
drop trigger if exists social_notify_comments on public.post_comments;
create trigger social_notify_comments after insert on public.post_comments for each row execute function public.social_notify();
drop trigger if exists social_notify_reactions on public.post_reactions;
create trigger social_notify_reactions after insert on public.post_reactions for each row execute function public.social_notify();
drop trigger if exists social_notify_follows on public.follows;
create trigger social_notify_follows after insert on public.follows for each row execute function public.social_notify();

-- رسائل الأعضاء إلى إدارة المكتبة (لا مراسلة خاصة بين الأعضاء)
create table if not exists public.admin_messages (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  user_name text,
  subject text not null check (length(subject) between 2 and 120),
  body text not null check (length(body) between 2 and 4000),
  reply text check (length(reply) <= 4000),
  replied_at timestamptz,
  status text not null default 'open' check (status in ('open','replied','closed')),
  created_at timestamptz not null default now()
);
create index if not exists admin_messages_user on public.admin_messages (user_id, created_at desc);
alter table public.admin_messages enable row level security;
drop policy if exists "admin messages read" on public.admin_messages;
create policy "admin messages read" on public.admin_messages for select using ((select auth.uid()) = user_id or public.is_staff());
drop policy if exists "admin messages own insert" on public.admin_messages;
create policy "admin messages own insert" on public.admin_messages for insert with check ((select auth.uid()) = user_id and reply is null and status = 'open');
drop policy if exists "admin messages staff update" on public.admin_messages;
create policy "admin messages staff update" on public.admin_messages for update using (public.is_staff());
-- إشعار العضو عند رد الإدارة
create or replace function public.admin_reply_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.reply is not null and (old.reply is distinct from new.reply) then
    insert into public.notifications(user_id, title, body, url) values (new.user_id, 'ردّت إدارة المكتبة على رسالتك', left(new.reply, 140), '#/messages');
  end if;
  return new;
exception when others then return new;
end $$;
revoke execute on function public.admin_reply_notify() from public, anon, authenticated;
drop trigger if exists admin_reply_notify on public.admin_messages;
create trigger admin_reply_notify after update on public.admin_messages for each row execute function public.admin_reply_notify();

-- صندوق رفع الكتب المصورة (خاص): يرفع المشرف الملف دفعة واحدة، ويأخذه التحويل برابط مؤقت
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('inbox', 'inbox', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;
drop policy if exists "inbox staff insert" on storage.objects;
create policy "inbox staff insert" on storage.objects for insert to authenticated with check (bucket_id = 'inbox' and public.is_staff());
drop policy if exists "inbox staff read" on storage.objects;
create policy "inbox staff read" on storage.objects for select to authenticated using (bucket_id = 'inbox' and public.is_staff());
drop policy if exists "inbox staff update" on storage.objects;
create policy "inbox staff update" on storage.objects for update to authenticated using (bucket_id = 'inbox' and public.is_staff());

-- إعدادات خاصة بالموقع (مثل رقم محادثة تليجرام للإشعارات): يقرؤها المدير، ويكتبها الخادم بمفتاح الخدمة
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.app_settings enable row level security;
drop policy if exists "app settings admin read" on public.app_settings;
create policy "app settings admin read" on public.app_settings for select using (public.is_admin());

-- ===== تقوية الأمان (23 أكتوبر) =====
alter policy "member pages own update" on public.member_pages using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "notifications own update" on public.notifications using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
alter policy "admin messages staff update" on public.admin_messages using (public.is_staff()) with check (public.is_staff());
alter policy "corrections staff update" on public.corrections using (public.is_staff()) with check (public.is_staff());
-- الاسم الظاهر يفرضه الخادم، مع حد للإغراق (التعريف الكامل في قاعدة البيانات: public.guard_member_write)

-- ===== مجتمع المكتبة (٢٤ أكتوبر ٢٠٢٦): تفاعلات متعددة، وإخفاء وتثبيت، وإيقاف الأعضاء، وبلاغات، ومعايير المجتمع =====
alter table public.post_reactions add column if not exists kind text not null default 'like';
-- post_reactions_kind_chk: kind in ('like','love','dua','benefit','wow','sad'); سياسة "reactions own update"
-- post_stats: أضيف عمود kinds (عدد كل تفاعل)
alter table public.member_posts add column if not exists hidden boolean not null default false;
alter table public.member_posts add column if not exists pinned boolean not null default false;
alter table public.member_posts add column if not exists hidden_reason text;
-- community_bans(user_id, scope post|all, reason, until, by_user, user_name) للمشرفين، والعضو يقرأ إيقافه
-- post_reports(post_id, user_id, reason, status open|done) العضو يبلّغ، والمشرفون يراجعون؛ ومشغّل report_notify يشعر المشرفين
-- app_settings: المفاتيح community_rules وcommunity_open وradio_channels يقرؤها الجميع ويكتبها المدير
-- is_banned(uid, scope) ويستعمله guard_member_write لمنع تعليق الموقوف؛ وapi/mpost يمنع نشره
-- notifications: سياسة "notifications staff insert"؛ وصندوق inbox يقبل ملفات الصوت

-- صيانة 24 أكتوبر: فهارس المفاتيح الأجنبية، وسحب تنفيذ دوال المشغّلات عبر RPC
create index if not exists comment_reactions_user_idx on public.comment_reactions(user_id);
create index if not exists conversations_user_idx on public.conversations(user_id);
create index if not exists corrections_user_idx on public.corrections(user_id);
create index if not exists direct_messages_recipient_idx on public.direct_messages(recipient);
create index if not exists notifications_user_idx on public.notifications(user_id);
create index if not exists post_comments_parent_idx on public.post_comments(parent_id);
create index if not exists post_comments_user_idx on public.post_comments(user_id);
create index if not exists post_reactions_user_idx on public.post_reactions(user_id);
create index if not exists post_reports_user_idx on public.post_reports(user_id);
create index if not exists post_saves_user_idx on public.post_saves(user_id);
create index if not exists push_subs_user_idx on public.push_subs(user_id);
revoke execute on function public.dm_notify() from public, anon, authenticated;
revoke execute on function public.report_notify() from public, anon, authenticated;

-- المسارات العلمية الخاصة وخطط القراءة (paths.js)
create table if not exists public.study_paths (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  id text not null, title text, books jsonb not null default '[]'::jsonb, plan jsonb,
  custom boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  progress jsonb, tz_offset int not null default 180, hour_utc int, last_sent date,
  primary key (user_id, id)
);
alter table public.study_paths add column if not exists progress jsonb;
alter table public.study_paths add column if not exists tz_offset int not null default 180;
alter table public.study_paths add column if not exists hour_utc int;
alter table public.study_paths add column if not exists last_sent date;
alter table public.study_paths enable row level security;
drop policy if exists "study_paths own" on public.study_paths;
create policy "study_paths own" on public.study_paths for all using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- ٦ نوفمبر: إحصاءات الواجهة العامة (أرقام مجمّعة فقط، بلا بيانات أعضاء)
-- عدّاد زيارات يومي: كل جهاز يُحسب مرة في اليوم (الواجهة تستدعي hit_visit مرة يوميًا)
create table if not exists public.site_visits (day date primary key, n bigint not null default 0);
alter table public.site_visits enable row level security;
create or replace function public.hit_visit() returns void
language sql security definer set search_path = public as $$
  insert into public.site_visits(day, n) values (current_date, 1)
  on conflict (day) do update set n = public.site_visits.n + 1;
$$;
create or replace function public.public_stats() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'members', (select count(*) from public.profiles),
    'visits', (select coalesce(sum(n), 0) from public.site_visits),
    'visits_today', (select coalesce(sum(n), 0) from public.site_visits where day = current_date),
    'path_members', (select count(distinct user_id) from public.study_paths),
    'readers', (select count(distinct user_id) from public.reading_plans where active)
  );
$$;
revoke execute on function public.hit_visit() from public;
revoke execute on function public.public_stats() from public;
grant execute on function public.hit_visit() to anon, authenticated;
grant execute on function public.public_stats() to anon, authenticated;

-- ٦ نوفمبر: سجل القراءة (بند ٧) وإحصاءات المحتوى (بند ٦)
-- سجل العضو: الصفحات التي قرأها فعلًا (بقي عليها ثوانيَ) لكل كتاب، ونسبة الإتمام وتاريخه. يراه العضو والإدارة.
create table if not exists public.book_reads (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  book_id text not null, total int not null default 0, pages int[] not null default '{}',
  first_at timestamptz not null default now(), last_at timestamptz not null default now(), last_page int, done_at timestamptz,
  primary key (user_id, book_id)
);
alter table public.book_reads enable row level security;
drop policy if exists "book_reads own or staff" on public.book_reads;
create policy "book_reads own or staff" on public.book_reads for select using ((select auth.uid()) = user_id or public.is_staff());
create index if not exists book_reads_book_idx on public.book_reads(book_id);
create index if not exists book_reads_last_idx on public.book_reads(last_at desc);
-- تجميع يومي عام لكل مادة: فتح، وصفحات مقروءة (أرقام فقط، بلا هوية)
create table if not exists public.content_daily (
  day date not null default current_date, book_id text not null,
  opens int not null default 0, pages int not null default 0,
  primary key (day, book_id)
);
alter table public.content_daily enable row level security;
create or replace function public.track_read(bid text, pg int, total int, is_open boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if bid is null or length(bid) > 80 or pg is null or pg < 1 or pg > 100000 then return; end if;
  insert into public.content_daily(day, book_id, opens, pages) values (current_date, bid, case when is_open then 1 else 0 end, 1)
  on conflict (day, book_id) do update set opens = public.content_daily.opens + excluded.opens, pages = public.content_daily.pages + 1;
  if uid is not null then
    insert into public.book_reads(user_id, book_id, total, pages, last_page) values (uid, bid, greatest(coalesce(total,0),0), array[pg], pg)
    on conflict (user_id, book_id) do update set
      total = greatest(excluded.total, public.book_reads.total),
      pages = case when pg = any(public.book_reads.pages) or cardinality(public.book_reads.pages) >= 20000 then public.book_reads.pages else public.book_reads.pages || pg end,
      last_at = now(), last_page = pg;
    update public.book_reads set done_at = now()
      where user_id = uid and book_id = bid and done_at is null and total > 0 and cardinality(pages) >= ceil(total * 0.9);
  end if;
end $$;
-- أعلى المواد: ترتيب بالمشاهدة أو التصفح أو القراء أو الإتمام، في مدة (أيام؛ ٠ = الكل)
create or replace function public.top_content(metric text default 'opens', days int default 30, lim int default 20) returns table(book_id text, opens bigint, pages bigint, readers bigint, completes bigint, avg_pct numeric)
language sql stable security definer set search_path = public as $$
  with d as (select c.book_id, sum(c.opens) opens, sum(c.pages) pages from public.content_daily c
             where days <= 0 or c.day > current_date - days group by c.book_id),
  r as (select b.book_id, count(*) readers, count(b.done_at) filter (where days <= 0 or b.done_at > now() - make_interval(days => days)) completes,
             round(avg(least(1, cardinality(b.pages)::numeric / nullif(b.total,0))) * 100, 1) avg_pct
        from public.book_reads b where days <= 0 or b.last_at > now() - make_interval(days => days) group by b.book_id)
  select coalesce(d.book_id, r.book_id), coalesce(d.opens,0), coalesce(d.pages,0), coalesce(r.readers,0), coalesce(r.completes,0), r.avg_pct
  from d full join r on r.book_id = d.book_id
  order by case metric when 'pages' then coalesce(d.pages,0) when 'readers' then coalesce(r.readers,0) when 'completes' then coalesce(r.completes,0) when 'pct' then coalesce(r.avg_pct,0) * 1000 + coalesce(r.readers,0) else coalesce(d.opens,0) end desc
  limit least(greatest(lim,1),100);
$$;
-- مجاميع عامة للمدة
create or replace function public.content_totals(days int default 30) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'opens', (select coalesce(sum(opens),0) from public.content_daily where days <= 0 or day > current_date - days),
    'pages', (select coalesce(sum(pages),0) from public.content_daily where days <= 0 or day > current_date - days),
    'readers', (select count(distinct user_id) from public.book_reads where days <= 0 or last_at > now() - make_interval(days => days)),
    'completes', (select count(*) from public.book_reads where done_at is not null and (days <= 0 or done_at > now() - make_interval(days => days))),
    'visits', (select coalesce(sum(n),0) from public.site_visits where days <= 0 or day > current_date - days),
    'series', (select coalesce(jsonb_agg(jsonb_build_array(day, o, p) order by day),'[]'::jsonb) from (select day, sum(opens) o, sum(pages) p from public.content_daily where day > current_date - least(greatest(days,7),90) group by day) s)
  );
$$;
-- سجل القراءة عند الإدارة: آخر نشاط الأعضاء
create or replace function public.admin_reads(lim int default 100) returns table(user_id uuid, name text, book_id text, pages int, total int, last_at timestamptz, done_at timestamptz)
language sql stable security definer set search_path = public as $$
  select b.user_id, p.name, b.book_id, cardinality(b.pages), b.total, b.last_at, b.done_at
  from public.book_reads b left join public.profiles p on p.id = b.user_id
  where public.is_staff() order by b.last_at desc limit least(greatest(lim,1),500);
$$;
revoke execute on function public.track_read(text,int,int,boolean) from public;
revoke execute on function public.top_content(text,int,int) from public;
revoke execute on function public.content_totals(int) from public;
revoke execute on function public.admin_reads(int) from public;
grant execute on function public.track_read(text,int,int,boolean) to anon, authenticated;
grant execute on function public.top_content(text,int,int) to anon, authenticated;
grant execute on function public.content_totals(int) to anon, authenticated;
grant execute on function public.admin_reads(int) to authenticated;
revoke execute on function public.admin_reads(int) from anon;

-- ٦ نوفمبر (٢): صلاحيات التفويض، والقراءة الجماعية، وتحدي القراءة

-- ١) صلاحيات يفوّضها المدير لأعضاء بعينهم (export_text: تنزيل النص القابل للتحرير، kurrasa: الكراسات، convert: تحويل الكتب، tashjir: التشجير، stats: سجل الأعضاء)
alter table public.profiles add column if not exists perms text[] not null default '{}';
create or replace function public.has_perm(p text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and (role = 'admin' or p = any(perms)));
$$;
create or replace function public.my_perms() returns text[]
language sql stable security definer set search_path = public as $$
  select coalesce((select case when role = 'admin' then array['*'] else perms end from public.profiles where id = auth.uid()), '{}');
$$;
-- بحث الأعضاء بالاسم (لدعوتهم إلى قراءة جماعية أو منحهم صلاحية)؛ للمسجلين فقط
create or replace function public.member_search(q text) returns table(id uuid, name text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name from public.profiles p
  where auth.uid() is not null and length(trim(coalesce(q,''))) >= 2 and p.name ilike '%' || trim(q) || '%'
  order by p.name limit 12;
$$;
create or replace function public.notify_staff(t text, b text, u text) returns void
language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, title, body, url) select id, t, b, u from public.profiles where role in ('admin','editor');
$$;
revoke execute on function public.notify_staff(text,text,text) from public, anon, authenticated;

-- ٢) القراءة الجماعية
create table if not exists public.group_reads (
  id bigserial primary key,
  book_id text not null, title text not null check (length(title) between 2 and 200), note text check (length(note) < 2000),
  owner uuid not null default auth.uid() references auth.users on delete cascade,
  start_date date not null default current_date, days int not null default 14 check (days between 1 and 365),
  start_page int not null default 1, end_page int not null default 1, read_time text default '21:00',
  visibility text not null default 'public' check (visibility in ('public','invite')),
  status text not null default 'active' check (status in ('requested','active','done','cancelled')),
  official boolean not null default false, created_at timestamptz not null default now()
);
create table if not exists public.group_members (
  group_id bigint not null references public.group_reads on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  status text not null default 'joined' check (status in ('invited','joined','left')),
  joined_at timestamptz not null default now(), primary key (group_id, user_id)
);
create table if not exists public.group_log (
  group_id bigint not null references public.group_reads on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  day_no int not null check (day_no between 1 and 365), pages int not null default 0 check (pages between 0 and 5000),
  note text check (length(note) < 1000), done_at timestamptz not null default now(),
  primary key (group_id, user_id, day_no)
);
create index if not exists group_members_user_idx on public.group_members(user_id);
create index if not exists group_log_user_idx on public.group_log(user_id);
create index if not exists group_reads_owner_idx on public.group_reads(owner);
alter table public.group_reads enable row level security;
alter table public.group_members enable row level security;
alter table public.group_log enable row level security;
create or replace function public.gr_member(g bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.group_members where group_id = g and user_id = auth.uid() and status <> 'left')
      or exists (select 1 from public.group_reads where id = g and owner = auth.uid());
$$;
drop policy if exists "group_reads read" on public.group_reads;
create policy "group_reads read" on public.group_reads for select using (visibility = 'public' and status <> 'requested' or owner = (select auth.uid()) or public.gr_member(id) or public.is_staff());
drop policy if exists "group_members read" on public.group_members;
create policy "group_members read" on public.group_members for select using (public.gr_member(group_id) or public.is_staff() or exists (select 1 from public.group_reads r where r.id = group_id and r.visibility = 'public'));
drop policy if exists "group_log read" on public.group_log;
create policy "group_log read" on public.group_log for select using (public.gr_member(group_id) or public.is_staff() or exists (select 1 from public.group_reads r where r.id = group_id and r.visibility = 'public'));
-- الكتابة كلها عبر الدوال التالية (تتحقق من الصلاحية وترسل الإشعارات)
create or replace function public.gr_create(p_book text, p_title text, p_note text, p_start date, p_days int, p_from int, p_to int, p_time text, p_vis text, p_invite uuid[] default '{}', p_official boolean default false) returns bigint
language plpgsql security definer set search_path = public as $$
declare g bigint; u uuid := auth.uid(); st text := 'active';
begin
  if u is null then raise exception 'سجّل الدخول أولًا'; end if;
  if p_official and not public.is_staff() then st := 'requested'; p_official := false; end if;
  insert into public.group_reads(book_id, title, note, owner, start_date, days, start_page, end_page, read_time, visibility, official, status)
  values (p_book, p_title, p_note, u, coalesce(p_start, current_date), coalesce(p_days, 14), greatest(coalesce(p_from,1),1), greatest(coalesce(p_to,1),1), coalesce(p_time,'21:00'), coalesce(p_vis,'public'), coalesce(p_official,false), st)
  returning id into g;
  insert into public.group_members(group_id, user_id, status) values (g, u, 'joined');
  if st = 'requested' then
    perform public.notify_staff('طلب قراءة جماعية: ' || p_title, 'عضو يطلب أن تعلن الإدارة قراءة جماعية لهذا الكتاب.', '#/group/' || g);
  end if;
  if coalesce(array_length(p_invite,1),0) > 0 then perform public.gr_invite(g, p_invite); end if;
  return g;
end $$;
create or replace function public.gr_invite(g bigint, uids uuid[]) returns int
language plpgsql security definer set search_path = public as $$
declare r public.group_reads; n int := 0; x uuid;
begin
  select * into r from public.group_reads where id = g;
  if r.id is null or not (r.owner = auth.uid() or public.is_staff() or public.gr_member(g) and r.visibility = 'public') then raise exception 'غير مسموح'; end if;
  foreach x in array coalesce(uids, '{}') loop
    if x is null or x = auth.uid() then continue; end if;
    insert into public.group_members(group_id, user_id, status) values (g, x, 'invited') on conflict do nothing;
    if found then
      insert into public.notifications(user_id, title, body, url) values (x, 'دعوة إلى قراءة جماعية: ' || r.title, 'تبدأ ' || r.start_date || ' لمدة ' || r.days || ' يومًا', '#/group/' || g);
      n := n + 1;
    end if;
    exit when n >= 50;
  end loop;
  return n;
end $$;
create or replace function public.gr_join(g bigint, p_leave boolean default false) returns void
language plpgsql security definer set search_path = public as $$
declare r public.group_reads; u uuid := auth.uid();
begin
  select * into r from public.group_reads where id = g;
  if u is null or r.id is null then raise exception 'غير متاح'; end if;
  if p_leave then update public.group_members set status = 'left' where group_id = g and user_id = u; return; end if;
  if r.status <> 'active' then raise exception 'القراءة غير مفتوحة'; end if;
  if r.visibility = 'invite' and not exists (select 1 from public.group_members where group_id = g and user_id = u) then raise exception 'بالدعوة فقط'; end if;
  insert into public.group_members(group_id, user_id, status) values (g, u, 'joined')
  on conflict (group_id, user_id) do update set status = 'joined', joined_at = now();
end $$;
-- تسجيل الورد: يُقبل بعد بدء يومه ولو متأخرًا (مرونة)، ويُعدَّل بتكراره، ويُلغى بصفحات سالبة
create or replace function public.gr_log(g bigint, p_day int, p_pages int, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare r public.group_reads; u uuid := auth.uid();
begin
  select * into r from public.group_reads where id = g;
  if u is null or r.id is null or not exists (select 1 from public.group_members where group_id = g and user_id = u and status = 'joined') then raise exception 'انضم إلى القراءة أولًا'; end if;
  if p_day < 1 or p_day > r.days or r.start_date + (p_day - 1) > current_date + 1 then raise exception 'لم يبدأ هذا اليوم بعد'; end if;
  if p_pages < 0 then delete from public.group_log where group_id = g and user_id = u and day_no = p_day; return; end if;
  insert into public.group_log(group_id, user_id, day_no, pages, note) values (g, u, p_day, p_pages, p_note)
  on conflict (group_id, user_id, day_no) do update set pages = excluded.pages, note = excluded.note, done_at = now();
end $$;
create or replace function public.gr_status(g bigint, p_status text, p_official boolean default null) returns void
language plpgsql security definer set search_path = public as $$
declare r public.group_reads;
begin
  select * into r from public.group_reads where id = g;
  if r.id is null or not (r.owner = auth.uid() or public.is_staff()) then raise exception 'غير مسموح'; end if;
  if p_official is not null and not public.is_staff() then raise exception 'للإدارة فقط'; end if;
  update public.group_reads set status = coalesce(p_status, status), official = coalesce(p_official, official) where id = g;
  if r.status = 'requested' and p_status = 'active' then
    insert into public.notifications(user_id, title, body, url) values (r.owner, 'اعتمدت الإدارة القراءة الجماعية: ' || r.title, null, '#/group/' || g);
  end if;
end $$;
-- لوحة القراءة: الأعضاء بأسمائهم وما سجلوه
create or replace function public.gr_board(g bigint) returns table(user_id uuid, name text, status text, days_done bigint, pages bigint, last_day int, last_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.user_id, p.name, m.status, count(l.day_no), coalesce(sum(l.pages),0), max(l.day_no), max(l.done_at)
  from public.group_members m left join public.profiles p on p.id = m.user_id
  left join public.group_log l on l.group_id = m.group_id and l.user_id = m.user_id
  where m.group_id = g and exists (select 1 from public.group_reads r where r.id = g and (r.visibility = 'public' or public.gr_member(g) or public.is_staff()))
  group by m.user_id, p.name, m.status order by count(l.day_no) desc, max(l.done_at);
$$;

-- ٣) تحدي القراءة: كتاب أو أكثر، بمدة، والتحقق بفتح كل صفحة (عدا المستثنى كالفهرس) والبقاء عليها حدًّا أدنى ثم تعليمها ✓
create table if not exists public.challenges (
  id bigserial primary key, title text not null, descr text, books text[] not null default '{}',
  req jsonb not null default '{}'::jsonb,   -- {book_id: [أرقام الصفحات المطلوبة]} يحسبها الموقع عند الإنشاء (يستثني الفهرس والمقدمات الفنية)
  starts_at timestamptz not null, ends_at timestamptz not null, min_dwell int not null default 15 check (min_dwell between 3 and 600),
  status text not null default 'open' check (status in ('draft','open','closed')),
  created_by uuid default auth.uid() references auth.users on delete set null, created_at timestamptz not null default now()
);
create table if not exists public.challenge_entries (
  challenge_id bigint not null references public.challenges on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  joined_at timestamptz not null default now(), finished_at timestamptz, primary key (challenge_id, user_id)
);
create table if not exists public.challenge_pages (
  challenge_id bigint not null references public.challenges on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  book_id text not null, page int not null, opened_at timestamptz not null default now(), checked_at timestamptz,
  primary key (challenge_id, user_id, book_id, page)
);
create index if not exists challenge_entries_user_idx on public.challenge_entries(user_id);
create index if not exists challenge_pages_user_idx on public.challenge_pages(user_id);
alter table public.challenges enable row level security;
alter table public.challenge_entries enable row level security;
alter table public.challenge_pages enable row level security;
drop policy if exists "challenges read" on public.challenges;
create policy "challenges read" on public.challenges for select using (status <> 'draft' or public.is_staff());
drop policy if exists "challenges staff insert" on public.challenges;
create policy "challenges staff insert" on public.challenges for insert with check (public.is_staff());
drop policy if exists "challenges staff update" on public.challenges;
create policy "challenges staff update" on public.challenges for update using (public.is_staff()) with check (public.is_staff());
drop policy if exists "challenge_entries read" on public.challenge_entries;
create policy "challenge_entries read" on public.challenge_entries for select using ((select auth.uid()) = user_id or public.is_staff());
drop policy if exists "challenge_pages own" on public.challenge_pages;
create policy "challenge_pages own" on public.challenge_pages for select using ((select auth.uid()) = user_id or public.is_staff());
create or replace function public.ch_join(c bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r public.challenges;
begin
  select * into r from public.challenges where id = c;
  if auth.uid() is null or r.id is null or r.status <> 'open' or now() > r.ends_at then raise exception 'التحدي غير مفتوح'; end if;
  insert into public.challenge_entries(challenge_id, user_id) values (c, auth.uid()) on conflict do nothing;
end $$;
-- فتح الصفحة: يُسجَّل وقت الفتح على الخادم (فلا يعتمد على ساعة الجهاز)
create or replace function public.ch_seen(c bigint, bid text, pg int) returns void
language plpgsql security definer set search_path = public as $$
declare r public.challenges;
begin
  select * into r from public.challenges where id = c;
  if auth.uid() is null or r.id is null or now() < r.starts_at or now() > r.ends_at or not (bid = any(r.books))
     or not exists (select 1 from public.challenge_entries where challenge_id = c and user_id = auth.uid()) then return; end if;
  insert into public.challenge_pages(challenge_id, user_id, book_id, page) values (c, auth.uid(), bid, pg)
  on conflict (challenge_id, user_id, book_id, page) do update set opened_at = case when public.challenge_pages.checked_at is null then now() else public.challenge_pages.opened_at end;
end $$;
-- تعليم الصفحة ✓: يُقبل إذا مضى على فتحها min_dwell ثانية على الأقل، وتُعلَن نهاية المتسابق عند اكتمال الصفحات المطلوبة
create or replace function public.ch_mark(c bigint, bid text, pg int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r public.challenges; o timestamptz; need int; got int; u uuid := auth.uid();
begin
  select * into r from public.challenges where id = c;
  if u is null or r.id is null or now() < r.starts_at or now() > r.ends_at then return jsonb_build_object('ok', false, 'why', 'التحدي غير قائم الآن'); end if;
  if not (coalesce(r.req -> bid, '[]'::jsonb) @> to_jsonb(pg)) then return jsonb_build_object('ok', false, 'why', 'هذه الصفحة ليست من صفحات التحدي'); end if;
  select opened_at into o from public.challenge_pages where challenge_id = c and user_id = u and book_id = bid and page = pg;
  if o is null then return jsonb_build_object('ok', false, 'why', 'افتح الصفحة واقرأها أولًا'); end if;
  if now() - o < make_interval(secs => r.min_dwell) then return jsonb_build_object('ok', false, 'why', 'اقرأ الصفحة أولًا', 'wait', ceil(r.min_dwell - extract(epoch from now() - o))); end if;
  update public.challenge_pages set checked_at = coalesce(checked_at, now()) where challenge_id = c and user_id = u and book_id = bid and page = pg;
  select sum(jsonb_array_length(v)) into need from jsonb_each(r.req) as e(k, v);
  select count(*) into got from public.challenge_pages p where p.challenge_id = c and p.user_id = u and p.checked_at is not null
    and coalesce(r.req -> p.book_id, '[]'::jsonb) @> to_jsonb(p.page);
  if got >= need then update public.challenge_entries set finished_at = coalesce(finished_at, now()) where challenge_id = c and user_id = u; end if;
  return jsonb_build_object('ok', true, 'got', got, 'need', need, 'done', got >= need);
end $$;
create or replace function public.ch_board(c bigint) returns table(user_id uuid, name text, checked bigint, finished_at timestamptz, joined_at timestamptz)
language sql stable security definer set search_path = public as $$
  select e.user_id, p.name, (select count(*) from public.challenge_pages x where x.challenge_id = c and x.user_id = e.user_id and x.checked_at is not null), e.finished_at, e.joined_at
  from public.challenge_entries e left join public.profiles p on p.id = e.user_id where e.challenge_id = c
  order by e.finished_at nulls last, 3 desc, e.joined_at limit 200;
$$;

revoke execute on function public.gr_create(text,text,text,date,int,int,int,text,text,uuid[],boolean) from public, anon;
revoke execute on function public.gr_invite(bigint,uuid[]) from public, anon;
revoke execute on function public.gr_join(bigint,boolean) from public, anon;
revoke execute on function public.gr_log(bigint,int,int,text) from public, anon;
revoke execute on function public.gr_status(bigint,text,boolean) from public, anon;
revoke execute on function public.member_search(text) from public, anon;
revoke execute on function public.ch_join(bigint) from public, anon;
revoke execute on function public.ch_seen(bigint,text,int) from public, anon;
revoke execute on function public.ch_mark(bigint,text,int) from public, anon;
grant execute on function public.gr_create(text,text,text,date,int,int,int,text,text,uuid[],boolean), public.gr_invite(bigint,uuid[]), public.gr_join(bigint,boolean), public.gr_log(bigint,int,int,text), public.gr_status(bigint,text,boolean), public.member_search(text), public.ch_join(bigint), public.ch_seen(bigint,text,int), public.ch_mark(bigint,text,int), public.has_perm(text), public.my_perms() to authenticated;
revoke execute on function public.gr_board(bigint) from public, anon;
revoke execute on function public.ch_board(bigint) from public, anon;
grant execute on function public.gr_board(bigint), public.ch_board(bigint) to authenticated;

-- ===== الأدوار (٧ نوفمبر ٢٠٢٦): شريك مدير، عضو مميز، وحماية المدير الأصلي =====
-- admin: المدير الأصلي منشئ الموقع • partner: شريك مدير (المجلس الأعلى) بصلاحيات كاملة عدا إزالة المدير الأصلي وتعطيل الموقع
-- editor: عضو فريق الإدارة بصلاحيات محدودة (team_perms) • premium: عضو مميز (نشر حر وخدمات إضافية) • member: عضو • الحظر: community_bans
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check check (role in ('member','premium','editor','partner','admin','sheikh'));
do $$ declare r record; d text; begin
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and prokind='f' and proname in ('is_admin','is_staff','has_perm','my_perms','report_notify','dm_allowed','dm_people','team_can','team_notify','notify_staff') loop
    d := pg_get_functiondef(r.oid);
    d := replace(d, 'role in (''editor'',''admin'')', 'role in (''editor'',''admin'',''partner'')');
    d := replace(d, 'role in (''admin'',''editor'')', 'role in (''admin'',''partner'',''editor'')');
    d := replace(d, 'role = ''admin''', 'role in (''admin'',''partner'')');
    execute d;
  end loop; end $$;
create or replace function public.guard_roles() returns trigger language plpgsql security definer set search_path = public as $$
declare me text;
begin
  if auth.uid() is null then return coalesce(new, old); end if;
  select role into me from public.profiles where id = auth.uid();
  if me = 'admin' then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    if old.role = 'admin' then raise exception 'لا يمكن حذف المدير الأصلي'; end if; return old; end if;
  if old.role = 'admin' and (new.role is distinct from old.role) then raise exception 'لا يمكن تغيير دور المدير الأصلي'; end if;
  if new.role = 'admin' and old.role is distinct from 'admin' then raise exception 'دور المدير الأصلي لا يُمنح'; end if;
  if (new.role = 'partner') is distinct from (old.role = 'partner') and me is distinct from 'partner' then raise exception 'منح الشراكة للمدير وشركائه فقط'; end if;
  return new;
end $$;
drop trigger if exists profiles_guard_roles on public.profiles;
create trigger profiles_guard_roles before update or delete on public.profiles for each row execute function public.guard_roles();

-- ٧ نوفمبر ٢٠٢٦ (مطبَّق): صندوق inbox يقبل صيغ صوت أخرى لرفع تسجيلات التفريغ من الجهاز (الفيديو والأكبر من ٥٠ م.ب يُرفع أجزاءً إلى المستودع)
update storage.buckets set allowed_mime_types = (select array_agg(distinct m) from unnest(allowed_mime_types || array['audio/flac','audio/x-flac','audio/opus','audio/amr','audio/3gpp','audio/x-aac','audio/m4a','audio/vnd.wave']) m) where id = 'inbox';

-- ١٣ نوفمبر ٢٠٢٦: صلاحيات مفوَّضة جديدة (profiles.perms): audio_upload رفع الكتب الصوتية وتسجيلاتها، radio جدول البث،
-- ask_vision رفع الصور والملفات إلى المساعدَين، ask_web المصادر الخارجية للمساعد العلمي، ask_models اختيار النماذج.
-- صاحب audio_upload يرفع إلى صندوق inbox (التسجيلات) كالمشرفين.
drop policy if exists "inbox audio insert" on storage.objects;
create policy "inbox audio insert" on storage.objects for insert to authenticated with check (bucket_id = 'inbox' and public.has_perm('audio_upload'));
drop policy if exists "inbox audio update" on storage.objects;
create policy "inbox audio update" on storage.objects for update to authenticated using (bucket_id = 'inbox' and public.has_perm('audio_upload'));

-- ١٣ نوفمبر ٢٠٢٦: جدول أسبوعي مرن للقراءة الجماعية (أيام القراءة في الأسبوع: 0 الأحد … 6 السبت؛ فارغ = كل يوم)
alter table public.group_reads add column if not exists week_days int[];
create or replace function public.gr_set_days(g bigint, wd int[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.group_reads where id = g and (owner = auth.uid() or public.is_staff())) then raise exception 'غير مسموح'; end if;
  update public.group_reads set week_days = (select array_agg(distinct x order by x) from unnest(wd) x where x between 0 and 6) where id = g;
end $$;
grant execute on function public.gr_set_days(bigint, int[]) to authenticated;
