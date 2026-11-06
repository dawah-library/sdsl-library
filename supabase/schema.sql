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
