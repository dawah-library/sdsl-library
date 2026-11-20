-- ٢٠ نوفمبر ٢٠٢٦ (المرحلة ٣-ج): المقارنات العلمية بين الكتب — يحفظها العضو خاصة أو يرسلها للنشر، والنشر العام باعتماد الإدارة.
-- آمن قابل للتكرار، ولا يمس جدولًا قائمًا. التراجع: 2026-11-20-comparisons.down.sql
create table if not exists public.comparisons (
  id bigserial primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  user_name text,
  title text not null check (length(title) <= 300),
  books text[] not null check (array_length(books, 1) between 2 and 6),
  axes text[] not null default '{}',
  topic text check (length(topic) <= 200),
  result jsonb not null check (jsonb_typeof(result) = 'object' and length(result::text) <= 60000),
  status text not null default 'private' check (status in ('private','pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create index if not exists comparisons_status on public.comparisons (status, created_at desc);
create index if not exists comparisons_user on public.comparisons (user_id, created_at desc);
alter table public.comparisons enable row level security;
drop policy if exists "comparisons read" on public.comparisons;
create policy "comparisons read" on public.comparisons for select using (status = 'approved' or (select auth.uid()) = user_id or public.is_staff());
drop policy if exists "comparisons insert own" on public.comparisons;
create policy "comparisons insert own" on public.comparisons for insert to authenticated with check ((select auth.uid()) = user_id and status in ('private','pending'));
drop policy if exists "comparisons update" on public.comparisons;
create policy "comparisons update" on public.comparisons for update using ((select auth.uid()) = user_id or public.is_staff())
  with check (public.is_staff() or ((select auth.uid()) = user_id and status in ('private','pending')));
drop policy if exists "comparisons delete" on public.comparisons;
create policy "comparisons delete" on public.comparisons for delete using ((select auth.uid()) = user_id or public.is_staff());
