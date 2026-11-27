-- ربط العضو بصفحة المؤلف وصلاحيات صفحته (طلب المدير، ٢٧ نوفمبر ٢٠٢٦ — البند ٤ من وثيقة الطلبات غير المنفذة). آمن للتكرار.
-- ١) author_claims: يطلب العضو «هذه صفحتي» بدليل هويته، وتقبل الإدارة أو ترفض أو تسحب. لا ربط بمجرد تطابق الاسم: القبول يدوي دائمًا.
-- ٢) عند القبول: profiles.author_id = المؤلف، ودور «حساب شيخ» لمن كان عضوًا (فينشر منشوراته باسم صفحته عبر api/mpost.js القائم)؛ وعند السحب يُعاد.
-- ٣) author_pages: صورة الصفحة ونبذتها يغيّرها صاحبها المعتمد وحده (أو الإدارة)، وتظهر على صفحة المؤلف فوق بيانات الفهرس.
-- ٤) author_drafts وحاوية author-drafts الخاصة: كتب يرفعها صاحب الصفحة تبقى مسودة حتى تعتمدها الإدارة.
alter table public.profiles add column if not exists author_id text;

create table if not exists public.author_claims (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  author_id text not null check (author_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  evidence text not null check (length(evidence) between 10 and 2000),
  contact text check (length(contact) <= 200),
  status text not null default 'pending' check (status in ('pending','approved','rejected','revoked')),
  note text check (length(note) <= 500),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz, reviewed_by uuid
);
create unique index if not exists author_claims_live on public.author_claims (user_id, author_id) where status in ('pending','approved');
create index if not exists author_claims_author on public.author_claims (author_id, status);
alter table public.author_claims enable row level security;
drop policy if exists "claims read" on public.author_claims;
create policy "claims read" on public.author_claims for select using (status = 'approved' or (select auth.uid()) = user_id or public.is_staff());
drop policy if exists "claims own insert" on public.author_claims;
create policy "claims own insert" on public.author_claims for insert to authenticated with check ((select auth.uid()) = user_id and status = 'pending' and reviewed_by is null and note is null);
drop policy if exists "claims own withdraw" on public.author_claims;
create policy "claims own withdraw" on public.author_claims for delete using ((select auth.uid()) = user_id and status = 'pending');
drop policy if exists "claims staff review" on public.author_claims;
create policy "claims staff review" on public.author_claims for update using (public.is_staff()) with check (public.is_staff());

-- هل للعضو الحالي ربط معتمد بهذا المؤلف؟
create or replace function public.owns_author(a text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.author_claims where user_id = auth.uid() and author_id = a and status = 'approved');
$$;
grant execute on function public.owns_author(text) to authenticated;

-- الإشعار والدور: طلب جديد ← الإدارة؛ قرار ← العضو؛ القبول يربط الحساب بالصفحة، والسحب يفكّه
create or replace function public.author_claims_flow() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.notifications(user_id, title, body, url)
      select p.id, 'طلب ربط حساب بصفحة مؤلف', left(new.evidence, 140), '#/admin?t=claims' from public.profiles p where p.role in ('admin','partner','editor');
    return new;
  end if;
  if new.status is distinct from old.status then
    new.reviewed_at := now(); new.reviewed_by := auth.uid();
    if new.status = 'approved' then
      update public.profiles set author_id = new.author_id, role = case when role = 'member' then 'sheikh' else role end where id = new.user_id;
      insert into public.notifications(user_id, title, body, url) values (new.user_id, 'قبلت الإدارة ربط حسابك بصفحتك في المكتبة', new.note, '#/author/' || new.author_id);
    elsif new.status = 'rejected' then
      insert into public.notifications(user_id, title, body, url) values (new.user_id, 'لم تقبل الإدارة طلب ربط حسابك بالصفحة', new.note, '#/author/' || new.author_id);
    elsif new.status = 'revoked' then
      update public.profiles set author_id = null, role = case when role = 'sheikh' then 'member' else role end where id = new.user_id and author_id = new.author_id;
      insert into public.notifications(user_id, title, body, url) values (new.user_id, 'سحبت الإدارة ربط حسابك بالصفحة', new.note, '#/author/' || new.author_id);
    end if;
  end if;
  return new;
end $$;
revoke execute on function public.author_claims_flow() from public, anon, authenticated;
drop trigger if exists author_claims_ins on public.author_claims;
create trigger author_claims_ins after insert on public.author_claims for each row execute function public.author_claims_flow();
drop trigger if exists author_claims_upd on public.author_claims;
create trigger author_claims_upd before update on public.author_claims for each row execute function public.author_claims_flow();

create table if not exists public.author_pages (
  author_id text primary key check (author_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  bio text check (length(bio) <= 1500),
  photo text check (length(photo) <= 300000 and (photo is null or photo ~ '^data:image/(jpeg|png|webp);base64,')),
  updated_by uuid default auth.uid(),
  updated_at timestamptz not null default now()
);
alter table public.author_pages enable row level security;
drop policy if exists "author pages read" on public.author_pages;
create policy "author pages read" on public.author_pages for select using (true);
drop policy if exists "author pages owner write" on public.author_pages;
create policy "author pages owner write" on public.author_pages for insert to authenticated with check (public.owns_author(author_id) or public.is_staff());
drop policy if exists "author pages owner update" on public.author_pages;
create policy "author pages owner update" on public.author_pages for update to authenticated using (public.owns_author(author_id) or public.is_staff()) with check (public.owns_author(author_id) or public.is_staff());

create table if not exists public.author_drafts (
  id bigserial primary key,
  author_id text not null check (author_id ~ '^[A-Za-z0-9_-]{1,64}$'),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  title text not null check (length(title) between 2 and 200),
  kind text not null default 'book' check (kind in ('book','article','tafrigh')),
  note text check (length(note) <= 1000),
  file text check (length(file) <= 300),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note text check (length(admin_note) <= 500),
  created_at timestamptz not null default now(), reviewed_at timestamptz
);
alter table public.author_drafts enable row level security;
drop policy if exists "drafts read" on public.author_drafts;
create policy "drafts read" on public.author_drafts for select using ((select auth.uid()) = user_id or public.is_staff());
drop policy if exists "drafts owner insert" on public.author_drafts;
create policy "drafts owner insert" on public.author_drafts for insert to authenticated with check ((select auth.uid()) = user_id and status = 'pending' and admin_note is null and public.owns_author(author_id));
drop policy if exists "drafts staff review" on public.author_drafts;
create policy "drafts staff review" on public.author_drafts for update using (public.is_staff()) with check (public.is_staff());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('author-drafts', 'author-drafts', false, 52428800, array['application/pdf','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document','text/plain','application/epub+zip'])
on conflict (id) do nothing;
drop policy if exists "author drafts upload" on storage.objects;
create policy "author drafts upload" on storage.objects for insert to authenticated with check (bucket_id = 'author-drafts' and public.owns_author(split_part(name, '/', 1)));
drop policy if exists "author drafts read" on storage.objects;
create policy "author drafts read" on storage.objects for select to authenticated using (bucket_id = 'author-drafts' and (public.is_staff() or public.owns_author(split_part(name, '/', 1))));
