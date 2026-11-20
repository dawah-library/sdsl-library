-- ٢٠ نوفمبر ٢٠٢٦ (المرحلة ٩): «كن من الأوائل» والنشرة البريدية. لا يقرأ الجدولَ إلا الخادم (المفتاح السري)؛ والعضو يعرف شارته بدالة is_founder.
-- آمن قابل للتكرار، ولا يمس جدولًا قائمًا. التراجع: 2026-11-20-subscribers.down.sql
create table if not exists public.subscribers (
  id bigserial primary key,
  email text not null unique check (length(email) <= 254),
  kinds text[] not null default '{}',
  token uuid not null default gen_random_uuid(),
  confirmed boolean not null default false,
  created_at timestamptz not null default now(),
  unsub_at timestamptz
);
create index if not exists subscribers_token on public.subscribers (token);
alter table public.subscribers enable row level security;  -- بلا سياسات: لا وصول من المتصفح إطلاقًا
create or replace function public.is_founder() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (select 1 from public.subscribers s join auth.users u on lower(u.email) = s.email
                 where u.id = auth.uid() and 'waitlist' = any(s.kinds) and s.unsub_at is null);
$$;
grant execute on function public.is_founder() to authenticated;
